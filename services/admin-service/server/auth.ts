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

export function setupAdminAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.ADMIN_SESSION_SECRET || 'admin-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: 'admin_sessions',
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours for admin sessions
      sameSite: 'strict',
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    'admin-local',
    new LocalStrategy(async (username, password, done) => {
      try {
        // Call core API to get user
        const user = await apiClient.get(`/api/core/users/username/${username}`);
        
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
          return done(null, false);
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        
        if (!passwordMatch) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        console.error('Admin login error:', error);
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

  // Admin-specific auth routes
  app.post("/api/admin/auth/login", 
    passport.authenticate("admin-local"), 
    (req, res) => {
      res.status(200).json({ 
        user: req.user, 
        message: 'Admin login successful' 
      });
    }
  );

  app.post("/api/admin/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/admin/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

export const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Admin authentication required" });
  }
  
  const user = req.user;
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return res.status(403).json({ message: "Admin privileges required" });
  }
  
  next();
};