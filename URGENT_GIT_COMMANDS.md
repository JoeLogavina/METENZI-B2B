# 🚨 URGENT: Git Commands to Fix DigitalOcean Deployment

## The Problem
DigitalOcean is still failing because the `@vitejs/plugin-react` package is in devDependencies in the Git repository, but it needs to be in production dependencies.

## ✅ The Solution - Run These Commands:

```bash
# 1. Check current package.json state in local workspace
npm list --depth=0 | grep "@vitejs/plugin-react"

# 2. Add Git changes and commit the dependency fixes
git add package.json package-lock.json
git commit -m "Fix: Move critical build dependencies to production for DigitalOcean

- Move @vitejs/plugin-react to production dependencies
- Move vite, esbuild, typescript to production dependencies  
- Ensures DigitalOcean build succeeds after devDependency pruning"

# 3. Push the fix to repository
git push origin main
```

## 🔍 Verification

After pushing, check that the package.json in your repository shows these packages in the main `dependencies` section (not `devDependencies`):

- `@vitejs/plugin-react`
- `vite` 
- `esbuild`
- `typescript`
- `tsx`

## 🚀 Then Deploy Again

Once these dependencies are in the production dependencies section and pushed to Git, the DigitalOcean build will succeed.

## Why This Fixes the Issue

DigitalOcean's build process:
1. ✅ Installs all dependencies (including dev)
2. ✅ Runs `npm run build` successfully 
3. ❌ **Prunes devDependencies** (removes @vitejs/plugin-react)
4. ❌ **Runs custom build command** `npm install && npm run build` (fails because @vitejs/plugin-react is gone)

Moving these to production dependencies ensures they survive the pruning step.