# DealQuest

## Starting the server

```bash
npm install
npx ng build
sudo cp -r dist/dealquest-ng/browser/* /var/www/dealquest/
sudo systemctl start nginx
```

## Monitor the server

```bash
sudo systemctl status nginx
```
