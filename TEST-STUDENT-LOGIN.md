# Student Login Test Instructions

## Prerequisites
- Dev server running: `npm run dev`
- Test student account created in Supabase

## Test Steps

### Test 1: Fresh Login
1. Open browser to `http://localhost:5173/login.html`
2. Enter student credentials
3. Click "Login"
4. **Expected:** Redirected to `/student/dashboard.html` and dashboard loads
5. **Actual:** _____________
6. **Status:** ✅ Pass / ❌ Fail

### Test 2: Page Refresh  
1. While on student dashboard, press F5 to refresh
2. **Expected:** Dashboard reloads without redirect to login
3. **Actual:** _____________
4. **Status:** ✅ Pass / ❌ Fail

### Test 3: Direct Navigation
1. Clear browser cache (optional)
2. Navigate directly to `http://localhost:5173/student/dashboard.html`
3. **Expected:** 
   - If logged in: Dashboard loads
   - If not logged in: Redirected to login page
4. **Actual:** _____________
5. **Status:** ✅ Pass / ❌ Fail

### Test 4: Browser Developer Console
1. Login as student
2. Navigate to student dashboard
3. Open browser console (F12)
4. Check for errors
5. **Expected:** No "[student-dashboard] No session available" errors
6. **Actual:** _____________
7. **Status:** ✅ Pass / ❌ Fail

### Test 5: Admin Login Still Works
1. Logout (if logged in)
2. Login as admin
3. **Expected:** Redirected to `/admin/dashboard.html`
4. **Actual:** _____________
5. **Status:** ✅ Pass / ❌ Fail

### Test 6: Teacher Login Still Works
1. Logout (if logged in)
2. Login as teacher
3. **Expected:** Redirected to `/teacher/dashboard.html`
4. **Actual:** _____________
5. **Status:** ✅ Pass / ❌ Fail

## Using Diagnostic Tool

### Option: Test with Diagnostic Page
1. Open `http://localhost:5173/test-student-auth.html`
2. Enter student email and password
3. Click "Test Login"
4. Review detailed authentication flow
5. If successful, click link to go to dashboard
6. Verify dashboard loads without redirect

## Browser Console Debugging

### Expected Console Messages (Normal Flow):
```
[student-dashboard] Wait for route guard to complete...
[student-dashboard] Route guard complete, loading profile...
[student-dashboard] Profile loaded successfully
```

### Error Messages (If Bug Still Exists):
```
❌ [student-dashboard] No session available despite route guard
❌ [auth] No valid session found, redirecting to login
```

## What Changed

### Files Modified:
1. `src/student-dashboard.js`
   - `initialize()` now waits for route guard before proceeding
   - `loadStudentProfile()` throws errors instead of redirecting

### Technical Details:
- **Root cause:** Race condition between route guard and dashboard initialization
- **Solution:** Dashboard waits for route guard to complete before loading profile
- **Wait mechanism:** Checks `document.documentElement.style.visibility` every 50ms
- **Max wait time:** 5 seconds (100 attempts × 50ms)

## Rollback (If Needed)

If the fix causes issues, revert with:
```bash
git checkout src/student-dashboard.js
```

## Success Criteria

✅ All 6 tests pass
✅ No console errors during normal login flow
✅ Student can refresh dashboard page without redirect
✅ Admin and teacher logins still work correctly
