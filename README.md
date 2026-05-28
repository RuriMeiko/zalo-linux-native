# Zalo Linux Port 2026
⚠️ **Work in Progress** - This project is under active development.
A Linux port of Zalo, bringing the popular Vietnamese messaging application to the Linux platform.

<img width="1280" height="799" alt="image" src="https://github.com/user-attachments/assets/7f3000e2-6d5d-4bc1-a4c1-d334f4d7a3e9" />

## Features

### ✅ Supported
- Message synchronization
- Version check bypass (no outdated version warnings)

### ❌ Unsupported
- Calling and video calling
- Some miscellaneous features

## Installation

### Option 1: Install script
1. **Clone the repository**:
   ```bash
   git clone https://github.com/realdtn2/zalo-linux-2026.git
   cd zalo-linux-2026
   ```
2. **Run the install script**:
   ```bash
   ./install.sh
   ```

### Option 2: AppImage
Download the latest AppImage from the [Releases](https://github.com/realdtn2/zalo-linux-2026/releases/latest) page, then:
```bash
chmod +x Zalo-*.AppImage
./Zalo-*.AppImage
```
No installation needed — fully self-contained, just run it.

### Building the AppImage yourself
```bash
git clone https://github.com/realdtn2/zalo-linux-2026.git
cd zalo-linux-2026
./build-appimage.sh
# output: dist/Zalo-<version>-x86_64.AppImage
```
Requires: `wget`, `unzip`

## Usage

**Launch the application**:
- Open Zalo from your application launcher or desktop launcher

**Start manually**:
```bash
./start.sh
```

**Update the application**:
- Update through the desktop launcher or app launcher
- Or manually run:
```bash
./update.sh
```

## Contributing

This is an active work-in-progress project. Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## Disclaimer

⚠️ This is a community port and is not officially affiliated with Zalo or VNG Corporation.

## Support

For issues, questions, or suggestions, please open an issue on the [GitHub Issues](https://github.com/realdtn2/zalo-linux-2026/issues) page.
