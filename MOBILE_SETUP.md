# Mobile Phone Setup Guide

## Running the App on Mobile Phone

### Step 1: Start the Development Server

Open a terminal in the project directory and run:

```bash
npm run dev -- -H 0.0.0.0 -p 3000
```

Or simply:

```bash
next dev -H 0.0.0.0 -p 3000
```

This binds the server to all network interfaces (0.0.0.0) so it's accessible from mobile phones.

### Step 2: Find Your Computer's Network IP

**On Windows:**

Open Command Prompt and run:
```bash
ipconfig
```

Look for "IPv4 Address" under your active network connection. It will look like:
- `10.239.250.128` or
- `192.168.x.x` or
- `10.x.x.x`

**On Mac:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Linux:**
```bash
hostname -I
```

### Step 3: Access on Mobile Phone

On your mobile phone, open a web browser and navigate to:

```
http://10.239.250.128:3000
```

Replace `10.239.250.128` with your actual computer's IP address found in Step 2.

### Step 4: Grant Camera Permissions

When you first access the app on mobile:

1. **iOS (Safari/Chrome):**
   - When prompted, tap "Allow" for camera access
   - If not prompted, check: Settings > [App Name] > Camera > Allow

2. **Android (Chrome/Firefox):**
   - When prompted, tap "Allow" for camera access
   - If not prompted, check: Settings > Apps > [App Name] > Permissions > Camera > Allow

3. **Browser Permission:**
   - Look for a permissions icon in the address bar
   - Tap it and allow camera access

### Step 5: Use the Scanner

Once camera access is granted:

1. Navigate to the **Scanner** page
2. Click **"Start Camera"** button
3. The camera should activate (takes 2-3 seconds)
4. You'll see a live feed from your phone's camera
5. Click **"Start Session"** to begin face detection

## Troubleshooting Camera Issues

### Camera Permission Denied

**Error:** "Camera permission denied. Please check your phone settings..."

**Solutions:**
1. Go to phone settings and manually grant camera permission
2. Close and reopen the app
3. Try a different browser (Chrome recommended for Android, Safari for iOS)
4. Clear browser cache: Settings > [Browser] > Clear Cache > Try again

### Camera Not Found

**Error:** "No camera found on this device..."

**Solutions:**
1. Verify your device has a working camera
2. Try using the rear camera instead of front camera (the app has fallbacks)
3. Restart the phone and try again

### Browser Not Supported

**Error:** "Camera not supported in this browser..."

**Recommended Browsers:**
- **Android:** Google Chrome (recommended), Firefox, Edge
- **iOS:** Safari (recommended), Chrome
- **Desktop (for testing):** Chrome, Firefox, Safari, Edge

### HTTPS/Secure Connection Error

**Note:** When accessing via local network IP (http://), camera works on modern browsers. If issues persist, ensure:

1. Both computer and phone are on the same WiFi network
2. No firewall is blocking the connection
3. Try accessing from browser: `http://10.239.250.128:3000` (not https)

## Testing Camera Access

To verify the camera is working before using the scanner:

1. On your phone, go to https://www.test-ipv6.com/ or any site that uses camera
2. Check if camera access works there
3. If it works elsewhere but not on this app, try clearing the app's site data:
   - Browser settings > Clear site data for this URL
   - Reload the app

## Performance Tips for Mobile

1. **Reduce Resolution:** If the app is slow, adjust constraints in `app/scanner/page.tsx`
   - Change `ideal: 1280` to `ideal: 640`
   - Change `ideal: 720` to `ideal: 360`

2. **Frame Rate:** Reduce from 30 to 15 fps if experiencing lag

3. **Device Storage:** Ensure phone has sufficient storage space

4. **Network:** Use a strong, stable WiFi connection (5GHz recommended)

5. **Device Cooling:** If phone gets hot during use, take a break or use a cooling case

## Network IP Changes

If your computer's IP address changes (common after reboot or WiFi reconnect):

1. Re-run `ipconfig` (Windows) to find the new IP
2. Access the new URL from your phone
3. Or use your computer's hostname instead:
   - Find your computer name in settings
   - Try: `http://COMPUTERNAME:3000`

## Port Already in Use

If port 3000 is already in use:

```bash
next dev -H 0.0.0.0 -p 3001
```

Then access: `http://10.239.250.128:3001`

## Still Having Issues?

1. **Check console errors:** On phone, press F12 (Chrome DevTools) or use Safari Console
2. **Check server logs:** Look at terminal where you ran `npm run dev`
3. **Try localhost first:** On the same computer, test with `http://localhost:3000`
4. **Firewall:** Ensure Windows/Mac firewall allows Node.js on port 3000
5. **Multiple WiFi:** Confirm both devices are on the same network (not guest networks)

---

**Last Updated:** April 2026
