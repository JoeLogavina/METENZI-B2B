import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { RateLimitConfig } from "./middleware/security-framework.middleware";
import { logger, logAuth } from "./lib/logger";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Handle bcrypt format (starts with $2b$)
  if (stored.startsWith('$2b$')) {
    return await bcrypt.compare(supplied, stored);
  }

  // Handle scrypt format (hashed.salt)
  if (stored.includes('.')) {
    const parts = stored.split(".");
    if (parts.length === 2) {
      const [hashed, salt] = parts;
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      return timingSafeEqual(hashedBuf, suppliedBuf);
    }
  }

  // Fallback to plain text comparison (for development only)
  return supplied === stored;
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Enable secure cookies in production
      sameSite: 'strict', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);

        if (!user) {
          logAuth.loginFailure(username, 'unknown', 'User not found');
          return done(null, false);
        }

        const passwordMatch = await comparePasswords(password, user.password);

        if (!passwordMatch) {
          logAuth.loginFailure(username, 'unknown', 'Invalid password');
          return done(null, false);
        } else {
          logAuth.loginSuccess(user.id, user.username, 'unknown');
          return done(null, user);
        }
      } catch (error) {
        logger.error('Authentication error', {
          category: 'auth',
          username,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    if (user) {
      logger.debug('User deserialized successfully', {
        category: 'auth',
        userId: user.id,
        username: user.username
      });
      done(null, user);
    } else {
      logger.warn('User not found during deserialization', {
        category: 'auth',
        userId: id
      });
      done(null, false);
    }
  } catch (error) {
    logger.error('Error deserializing user', {
      category: 'auth',
      userId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    done(null, false);
  }
});

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      logger.error('User registration failed', {
        category: 'auth',
        username: req.body?.username,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip
      });
      res.status(500).send("Registration failed");
    }
  });

  app.post("/api/login", 
    passport.authenticate("local"), 
    (req, res) => {
      // Store user agent for session security
      if (req.session) {
        (req.session as any).userAgent = req.get('User-Agent');
        (req.session as any).createdAt = Date.now();
      }
      res.status(200).json(req.user);
    }
  );

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    console.log("User data returned:", req.user);
    res.json(req.user);
  });
}