#!/bin/sh
# experiments/iphone-heel/certificate.sh
set -eu
ip=${1:?usage: certificate.sh MAC_LAN_IP CERT_DIRECTORY}; dir=${2:?usage: certificate.sh MAC_LAN_IP CERT_DIRECTORY}
mkdir -p "$dir"
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 14 -keyout "$dir/iphone-heel.key" -out "$dir/iphone-heel.crt" -subj '/CN=Telltales iPhone heel experiment' -addext "subjectAltName=IP:$ip" -addext 'extendedKeyUsage=serverAuth'
openssl x509 -in "$dir/iphone-heel.crt" -outform der -out "$dir/iphone-heel.cer"
