# 🍎 Mac Android Build Setup Guide

Complete guide to build the Jantile Tracker Android APK on a fresh Mac.

**Estimated Time:** 30-45 minutes

---

## Prerequisites Checklist

- [ ] macOS (Apple Silicon or Intel)
- [ ] Internet connection
- [ ] ~15GB free disk space (for Android Studio + SDK)

---

## Step 1: Install Homebrew

Homebrew is the package manager for macOS. Open **Terminal** (Cmd+Space, type "Terminal") and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**For Apple Silicon Macs (M1/M2/M3)**, after installation, run:
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

Verify installation:
```bash
brew --version
```

---

## Step 2: Install Node.js

```bash
brew install node
```

Verify:
```bash
node --version  # Should show v20.x or higher
npm --version   # Should show 10.x or higher
```

---

## Step 3: Install Git

```bash
brew install git
```

Verify:
```bash
git --version
```

---

## Step 4: Install Java 17 (Required for Android builds)

```bash
brew install openjdk@17
```

Add Java to your PATH:
```bash
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
source ~/.zshrc
```

Verify:
```bash
java -version  # Should show openjdk 17.x
```

---

## Step 5: Install Android Studio

1. **Download Android Studio:**
   - Go to: https://developer.android.com/studio
   - Click "Download Android Studio"
   - Choose the Mac version (Apple Silicon or Intel)

2. **Install:**
   - Open the downloaded .dmg file
   - Drag Android Studio to Applications
   - Open Android Studio

3. **Complete Setup Wizard:**
   - Choose "Standard" installation
   - Accept all licenses
   - Wait for downloads to complete (~10-15 min)

4. **Install Additional SDK Tools:**
   - Open Android Studio
   - Go to: **Android Studio → Settings** (or Preferences)
   - Navigate to: **Languages & Frameworks → Android SDK → SDK Tools**
   - Check and install:
     - ✅ Android SDK Build-Tools
     - ✅ Android SDK Command-line Tools (latest)
     - ✅ Android SDK Platform-Tools
   - Click "Apply" and wait for installation

---

## Step 6: Set Android Environment Variables

Run these commands in Terminal:

```bash
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/emulator' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin' >> ~/.zshrc
source ~/.zshrc
```

Verify:
```bash
echo $ANDROID_HOME  # Should show /Users/YOUR_USERNAME/Library/Android/sdk
adb --version       # Should show Android Debug Bridge version
```

---

## Step 7: Clone the Repository

```bash
cd ~
git clone https://github.com/YOUR_ORG/JantileTracker2.git
cd JantileTracker2
```

> **Note:** Replace `YOUR_ORG` with your actual GitHub organization or username.

If the repo is private, you may need to authenticate:
```bash
git config --global credential.helper osxkeychain
```

---

## Step 8: Install Project Dependencies

```bash
npm install
```

This will install all Node.js dependencies. Wait for it to complete (~2-3 min).

---

## Step 9: Generate Android Project

This creates the native Android project from Expo:

```bash
npx expo prebuild --platform android
```

This will:
- Create the `android/` folder
- Generate all native code
- Configure Gradle build files

---

## Step 10: Build the APK

Navigate to the android folder and build:

```bash
cd android
./gradlew assembleRelease
```

**First build takes 5-10 minutes** (downloads Gradle dependencies).

---

## Step 11: Get Your APK! 🎉

The APK will be located at:

```
~/JantileTracker2/android/app/build/outputs/apk/release/app-release.apk
```

To open in Finder:
```bash
open ~/JantileTracker2/android/app/build/outputs/apk/release/
```

---

## Installing on Android Device

### Option A: Direct Install via USB
1. Enable **Developer Options** on your Android phone
2. Enable **USB Debugging**
3. Connect phone via USB
4. Run:
```bash
adb install ~/JantileTracker2/android/app/build/outputs/apk/release/app-release.apk
```

### Option B: Transfer APK
1. Upload APK to Google Drive, Dropbox, or email it
2. Download on your Android device
3. Open and install (you may need to allow "Install from unknown sources")

---

## Troubleshooting

### "Command not found: brew"
Run the Homebrew installation again and make sure to follow the post-install instructions.

### "JAVA_HOME is not set"
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

### "SDK location not found"
Make sure Android Studio completed its setup and ANDROID_HOME is set:
```bash
echo $ANDROID_HOME
ls $ANDROID_HOME  # Should list: build-tools, emulator, platforms, etc.
```

### Gradle build fails with memory error
```bash
cd android
./gradlew assembleRelease --max-workers=2
```

### "Permission denied" on gradlew
```bash
chmod +x ./gradlew
./gradlew assembleRelease
```

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Clean build | `cd android && ./gradlew clean` |
| Build debug APK | `./gradlew assembleDebug` |
| Build release APK | `./gradlew assembleRelease` |
| Install on device | `adb install app/build/outputs/apk/release/app-release.apk` |
| List connected devices | `adb devices` |
| Regenerate native code | `npx expo prebuild --clean --platform android` |

---

## Next Steps After Successful Build

1. Test the APK on a real Android device
2. If everything works, we can set up EAS for automated builds
3. Configure app signing for Google Play Store distribution

---

*Last updated: February 2026*
