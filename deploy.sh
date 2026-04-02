#!/bin/bash
# Run this on your VMware VM (Ubuntu/Debian)

# 1. Install nginx and Node.js if not already installed
sudo apt update
sudo apt install -y nginx nodejs npm

# 2. Install Angular CLI globally
sudo npm install -g @angular/cli

# 3. Copy the project to the VM and build (or scp the dist folder directly)
# Option A: build on VM
#   cd /home/$USER/dealquest-ng && npm install && ng build

# Option B: copy the pre-built dist from Windows to VM
#   scp -r dist/dealquest-ng/browser user@<VM_IP>:/var/www/dealquest

# 4. Deploy the built files
sudo mkdir -p /var/www/dealquest
sudo cp -r dist/dealquest-ng/browser/* /var/www/dealquest/

# 5. Install nginx config
sudo cp nginx.conf /etc/nginx/sites-available/dealquest
sudo ln -sf /etc/nginx/sites-available/dealquest /etc/nginx/sites-enabled/dealquest
sudo rm -f /etc/nginx/sites-enabled/default

# 6. Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx

echo "DealQuest is live at http://$(hostname -I | awk '{print $1}')"
