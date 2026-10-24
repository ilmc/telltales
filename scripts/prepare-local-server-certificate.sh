#!/bin/sh
# scripts/prepare-local-server-certificate.sh
# Local TLS identity preparation for explicitly authorised Telltales services.
set -eu

host=${1:?usage: prepare-local-server-certificate.sh SERVER_HOST_OR_IP CERT_DIRECTORY}
dir=${2:?usage: prepare-local-server-certificate.sh SERVER_HOST_OR_IP CERT_DIRECTORY}
key="$dir/telltales-server.key"
crt="$dir/telltales-server.crt"
cer="$dir/telltales-server.cer"

case "$host" in
  *[!0-9.]* ) san="DNS:$host"; san_display="DNS:$host" ;;
  * ) san="IP:$host"; san_display="IP Address:$host" ;;
esac

umask 077
mkdir -p "$dir"

if [ -f "$key" ] && [ -f "$crt" ] && [ -f "$cer" ]; then
  if openssl x509 -in "$crt" -noout -checkend 604800 >/dev/null 2>&1 && \
    openssl x509 -in "$crt" -noout -ext subjectAltName | grep -F "$san_display" >/dev/null; then
    echo "Reusing valid local Telltales server certificate for $host."
    exit 0
  fi
  if [ "${TELLTALES_SERVER_CERT_ROTATE:-}" != "1" ]; then
    echo "existing certificate is expired or does not match $host; inspect it, then rerun with TELLTALES_SERVER_CERT_ROTATE=1 to replace it" >&2
    exit 1
  fi
elif [ -e "$key" ] || [ -e "$crt" ] || [ -e "$cer" ]; then
  echo "refusing to use partial local TLS material in $dir; repair it deliberately" >&2
  exit 1
fi

openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 90 \
  -keyout "$key" -out "$crt" -subj '/CN=Telltales local server' \
  -addext "subjectAltName=$san" -addext 'extendedKeyUsage=serverAuth' 2>/dev/null
openssl x509 -in "$crt" -outform der -out "$cer"
chmod 600 "$key" "$crt" "$cer"
echo "Created local Telltales server certificate for $host (90 days)."
