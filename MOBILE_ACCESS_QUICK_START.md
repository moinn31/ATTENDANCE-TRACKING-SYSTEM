# 📱 Mobile Access Quick Start

**Your Server is Running!** ✓

## Access URL (Use on Your Mobile Phone)
```
http://10.239.250.128:3000
```

## Step-by-Step Mobile Setup

### 1️⃣ Phone Browser Connection
- Open your phone's web browser (Chrome for Android, Safari for iOS)
- Enter: `http://10.239.250.128:3000`
- Press Enter

### 2️⃣ Login
- Email: (use your test account)
- Password: (enter password)
- Tap "Login"

### 3️⃣ Camera Permission
When the app asks for camera permission:

**Android (Chrome):**
- Tap "Allow" on the browser prompt
- Or: Settings > Apps > [App Name] > Permissions > Camera > Allow

**iOS (Safari):**
- Tap "Allow" on the browser prompt  
- Or: Settings > [App Name] > Camera > Allow

### 4️⃣ Test Camera (Optional)
- Go to **Camera Check** from the sidebar
- Tap **"Test Camera Access"** button
- If your camera lights up, everything works! ✅

### 5️⃣ Use Scanner for Attendance
- Go to **Attendance** page
- Tap **"Start Camera"** button
- The live camera feed should appear
- Frame faces in view to start recognition

## Important Tips

✅ **Both devices must be on same WiFi network**
✅ **Keep WiFi stable - 5GHz recommended**
✅ **Allow ~2-3 seconds for camera to activate**
✅ **Good lighting helps face detection**
✅ **Use back camera (environment) for best results**

## If Camera Doesn't Work

### Check Permission
1. Open phone **Settings**
2. Go to **Apps** section
3. Find your **Browser** (Chrome/Safari)
4. Go to **Permissions**
5. Enable **Camera** ✓

### Try Different Browser
- Chrome (Android) - Recommended
- Firefox (Android)
- Safari (iOS) - Recommended
- Edge

### Try the Camera Check Page
1. Tap **Camera Check** from sidebar
2. Read the diagnostic info
3. Tap **"Test Camera Access"**
4. See detailed error messages if any issues

### Still Not Working?
1. Refresh page: Pull down on browser, release to refresh
2. Close browser completely, reopen, try again
3. Restart your phone
4. Check if device has a working camera

## Network Troubleshooting

**Can't connect to 10.239.250.128?**
- Is WiFi connected? Check phone settings
- Is computer still running? Look at your PC
- Is server still running? Check terminal for `✓ Ready`
- Try the local URL instead: `http://localhost:3000` (on same computer only)

**Server not responding?**
- Go back to terminal
- Look for error messages (red text)
- Restart: Press Ctrl+C, then `npm run dev -- -H 0.0.0.0 -p 3000`

## Account Access (For Testing)

**Login Credentials:**
- Email: (use existing test account)
- Password: (your test password)

**Need to Register?**
1. Go to `http://10.239.250.128:3000/auth/signup`
2. Create new account
3. Login with new credentials

## Camera Detection Tips

For best face recognition:
- **Lighting:** Well-lit room, face clearly visible
- **Distance:** 1-2 feet from camera (arm's length)
- **Angle:** Look directly at camera
- **Movement:** Slow, gentle head movements (left→right)
- **Frame Rate:** Takes 3+ frames to confirm detection

---

**Server Running:** ✅ Ready at `http://10.239.250.128:3000`
**Last Updated:** April 16, 2026
