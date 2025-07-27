import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { apiClient } from "./api-client";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupB2BAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.B2B_SESSION_SECRET || 'b2b-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: 'b2b_sessions',
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for B2B users
      sameSite: 'lax',
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    'b2b-local',
    new LocalStrategy(async (username, password, done) => {
      try {
        // Call core API to get user
        const user = await apiClient.get(`/api/core/users/username/${username}`);
        
        if (!user || user.role !== 'b2b_user') {
          return done(null, false);
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        
        if (!passwordMatch) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        console.error('B2B login error:', error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await apiClient.get(`/api/core/users/${id}`);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // B2B-specific auth routes
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { username, password, email, firstName, lastName } = req.body;
      
      // Check if user exists
      const existingUser = await apiClient.get(`/api/core/users/username/${username}`).catch(() => null);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Create user via core API
      const user = await apiClient.post("/api/core/users", {
        username,
        password: await hashPassword(password),
        email,
        firstName,
        lastName,
        role: 'b2b_user',
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).send("Registration failed");
    }
  });

  app.post("/api/auth/login", 
    passport.authenticate("b2b-local"), 
    (req, res) => {
      res.status(200).json(req.user);
    }
  );

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

export const requireB2BUser = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  const user = req.user;
  if (user.role !== 'b2b_user') {
    return res.status(403).json({ message: "B2B user access required" });
  }
  
  next();
};