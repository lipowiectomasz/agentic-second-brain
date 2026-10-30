#!/bin/sh
set -eu

file="$1"
domain="$2"
ip="$3"

test -f "$file" || { echo "$file not found; run make appwrite-install first" >&2; exit 2; }

set_var() {
  if grep -q "^$1=" "$file"; then
    sed -i "s|^$1=.*|$1=\"$2\"|" "$file"
  else
    printf '%s="%s"\n' "$1" "$2" >> "$file"
  fi
}

set_secret_if_empty() {
  if ! grep -qE "^$1=\"?[^\"]+" "$file"; then
    set_var "$1" "$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
    echo "generated $1"
  fi
}

set_secret_if_empty _APP_OPENSSL_KEY_V1
set_secret_if_empty _APP_EXECUTOR_SECRET
set_var _APP_DOMAIN "$domain"
set_var _APP_DOMAIN_TARGET "$domain"
set_var _APP_DOMAIN_TARGET_CNAME "$domain"
set_var _APP_DOMAIN_TARGET_A "$ip"
set_var _APP_DOMAIN_TARGET_AAAA ""
set_var _APP_DOMAIN_SITES "sites.$domain"
set_var _APP_DOMAIN_FUNCTIONS "functions.$domain"
set_var _APP_OPTIONS_FORCE_HTTPS "disabled"
set_var _APP_OPTIONS_ROUTER_FORCE_HTTPS "disabled"
set_var _APP_OPTIONS_FUNCTIONS_FORCE_HTTPS "disabled"
set_var _APP_CONSOLE_WHITELIST_ROOT "enabled"
set_var _APP_COMPUTE_INACTIVE_THRESHOLD "604800"
set_var _APP_FUNCTIONS_INACTIVE_THRESHOLD "604800"
set_var _APP_CONSOLE_DOMAIN "localhost"
set_var _APP_ENV "production"
chmod 600 "$file"
echo "public settings written to $file"
