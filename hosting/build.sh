#!/bin/sh
# Собирает папку для загрузки на обычный хостинг с PHP: сайт + админка без Google.
# Запуск из корня репозитория: sh hosting/build.sh  ->  папка dist/
set -e
rm -rf dist && mkdir -p dist/backups
cp -r index.html admin.html css js media dist/
cp hosting/api.php hosting/config.php hosting/data.json hosting/.htaccess dist/
cp hosting/backups/.htaccess dist/backups/
# сайт и админка берут данные у api.php рядом с собой, а не у Google
sed -i 's#const API_URL = "[^"]*";#const API_URL = "api.php";#' dist/js/main.js dist/js/admin.js
grep -q 'const API_URL = "api.php"' dist/js/main.js && grep -q 'const API_URL = "api.php"' dist/js/admin.js
echo "Готово: папка dist/. Перед загрузкой впишите пароль в dist/config.php."
