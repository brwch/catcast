# LG webOS TV Installation Guide (CatCast)

> **Compatibility Note:** The CatCast Receiver has been tested on webOS 3.9 (LG 49UJ620V) and is expected to be compatible with newer versions of webOS Smart TVs.

To install the CatCast Receiver on an LG Smart TV, the packaged application file (`.ipk`) must be transferred to the TV using LG's developer tools. A pre-built `.ipk` file is available in the [Releases](https://github.com/brwch/catcast/releases) section.

Follow the instructions below to set up the receiver:

## Prerequisites

1. **Network Connection:** The LG TV and the host PC must be connected to the same local network.
2. **Node.js:** Installed on the host PC.
3. **webOS CLI:** Installed on the host PC. Available from the [LG Developer Portal](https://webostv.developer.lge.com/develop/tools/cli-installation).

## Step 1: Enable Developer Mode on the TV

1. Open the **LG Content Store** on the TV and search for **"Developer Mode"**.
2. Install and launch the Developer Mode application.
3. Log in with an LG Developer account (registration available at [developer.lge.com](https://developer.lge.com)).
4. Enable **Developer Mode Status**. The TV will restart.
5. After the restart, open the Developer Mode application again and enable the **Key Server**.
6. Note the **IP Address** and **Passphrase** displayed on the screen.

## Step 2: Register the TV with the PC

Open a terminal on the PC and run:

```bash
ares-setup-device
```

Follow the prompts:
- Select `add`
- Enter `lg-tv` as the device name - **this exact name is required** for the deployment script to work
- Select device type: `tv`
- Enter the TV's IP address (from Step 1)
- Leave the port as `9922`
- Enter SSH user: `prisoner`
- Leave description and password blank

Then retrieve the SSH key from the TV:

```bash
ares-novacom --device lg-tv --getkey
```

When prompted, enter the **Passphrase** displayed in the TV's Developer Mode application.

## Step 3: Deploy the Application

Download the latest `.ipk` file from the [Releases](https://github.com/brwch/catcast/releases) page.

### Automatic Deployment (Windows, Recommended)

A PowerShell script is provided to automate the installation process:

1. Place `deploy.ps1` and the downloaded `.ipk` file in the same directory.
2. Right-click `deploy.ps1` and select **Run with PowerShell**.
3. The script will automatically install and launch the application on the `lg-tv` device.

<div align="left">
<img width="755" height="338" alt="Powershell" src="https://github.com/user-attachments/assets/582b5817-deb2-4620-b8e1-ed55f675364f" />
</div>

### Manual Deployment

To install the application manually:

```bash
ares-install -d lg-tv com.mary.catcast_1.0.0_all.ipk
```

To launch the installed application:

```bash
ares-launch -d lg-tv com.mary.catcast
```

### Building from Source (Optional)

If you want to rebuild the `.ipk` from source instead of using the prebuilt release, navigate to the `catreceiver` directory and run:

```bash
cd path/to/catcast/catreceiver
ares-package .
```

This will generate a new `.ipk` file that can be deployed using the manual or automatic method above.

## Step 4: Maintaining Developer Mode

The Developer Mode session expires after a set period (typically 50 or 999 hours). When it expires, sideloaded apps are removed from the TV. To prevent this:

- Manually extend the session timer in the Developer Mode app before it expires.
- Alternatively, use a community tool such as [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop) to manage the session more conveniently.

---

**Installation Complete.** Open the CatCast application on the TV and enter the host PC's IP address to begin streaming.
