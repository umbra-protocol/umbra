# SSL/TLS Configuration Guide - x402 ZK Payment System

## 🔒 Overview

This guide covers SSL/TLS setup for production deployment. SSL/TLS is **MANDATORY** for production to protect API keys, proof data, and prevent man-in-the-middle attacks.

---

## 📋 Options for SSL/TLS

### Option 1: Reverse Proxy (Recommended)

**Best for**: Production deployments

Use nginx/Caddy as reverse proxy to handle SSL/TLS termination.

**Pros:**
- Easier to configure
- Better performance
- Handles HTTP/2, gzip compression
- Can implement additional security (rate limiting, WAF)

**Cons:**
- Additional component to manage

### Option 2: Direct TLS in Go Service

**Best for**: Simple deployments, testing

Implement TLS directly in the prover service.

**Pros:**
- Simpler architecture
- One less component

**Cons:**
- More complex certificate management
- No HTTP/2 optimization
- Harder to implement advanced features

---

## 🎯 Option 1: Nginx Reverse Proxy (Recommended)

### Step 1: Install Nginx

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nginx
```

**Windows:**
Download from https://nginx.org/en/download.html

### Step 2: Obtain SSL Certificate

**Using Let's Encrypt (Free, Recommended):**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot will automatically configure nginx
```

**Using Your Own Certificate:**
```bash
# Place certificate files
sudo cp your-domain.crt /etc/ssl/certs/
sudo cp your-domain.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/your-domain.key
```

### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/x402-zk-prover`:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=prover_limit:10m rate=10r/m;

# Upstream servers (prover instances)
upstream prover_backend {
    least_conn;  # Load balancing method
    server localhost:8080 max_fails=3 fail_timeout=30s;
    server localhost:8081 max_fails=3 fail_timeout=30s;  # Add more instances
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Certificate
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL Configuration (Mozilla Modern)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # SSL Session Cache
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/your-domain.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'" always;

    # Remove nginx version header
    server_tokens off;

    # Logging
    access_log /var/log/nginx/x402-prover-access.log;
    error_log /var/log/nginx/x402-prover-error.log warn;

    # Max body size (for proof requests)
    client_max_body_size 10M;

    # Timeouts
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;

    # Rate limiting
    limit_req zone=prover_limit burst=20 nodelay;
    limit_req_status 429;

    # Health check (bypass rate limit)
    location /health {
        access_log off;
        proxy_pass http://prover_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Metrics (restrict to internal IPs)
    location /metrics {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;

        proxy_pass http://prover_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Main application
    location / {
        proxy_pass http://prover_backend;
        proxy_http_version 1.1;

        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;

        # Error handling
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 2;
    }

    # Block access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

### Step 4: Enable and Test

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/x402-zk-prover /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Enable auto-start
sudo systemctl enable nginx
```

### Step 5: Test SSL

```bash
# Test HTTPS connection
curl -I https://your-domain.com/health

# Test SSL grade (A+ expected)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com
```

### Step 6: Auto-Renewal

```bash
# Certbot auto-renewal (already configured)
# Test renewal
sudo certbot renew --dry-run

# Check renewal cron job
sudo systemctl status certbot.timer
```

---

## 🔧 Option 2: Direct TLS in Go Service

### Step 1: Obtain Certificate

Same as Option 1 - use Let's Encrypt or your own certificate.

### Step 2: Configure Prover Service

Edit `prover/.env.production`:

```bash
ENABLE_TLS=true
TLS_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

### Step 3: Update Prover Code

The prover service already supports TLS. When `ENABLE_TLS=true`, it will:
- Listen on port 443 instead of 8080
- Use TLS certificate and key
- Redirect HTTP to HTTPS

### Step 4: Start Service

```bash
cd prover
go run main.go
```

Service will now be available at `https://your-domain.com`

---

## 🔐 Security Best Practices

### Certificate Management

**DO:**
- ✅ Use Let's Encrypt for free, automated certificates
- ✅ Use 4096-bit RSA or 256-bit ECC keys
- ✅ Enable auto-renewal
- ✅ Monitor certificate expiration (alert 30 days before)
- ✅ Keep private keys secure (chmod 600)
- ✅ Use separate certificates per service

**DON'T:**
- ❌ Use self-signed certificates in production
- ❌ Share private keys
- ❌ Store private keys in version control
- ❌ Use certificates with wildcard domains unnecessarily
- ❌ Forget to renew certificates

### TLS Configuration

**DO:**
- ✅ Use TLS 1.2 and 1.3 only
- ✅ Disable SSLv3, TLS 1.0, TLS 1.1
- ✅ Use strong cipher suites
- ✅ Enable OCSP stapling
- ✅ Enable HSTS (Strict-Transport-Security)
- ✅ Set up certificate pinning for clients

**DON'T:**
- ❌ Allow weak ciphers (3DES, RC4)
- ❌ Skip HSTS header
- ❌ Expose TLS keys in logs
- ❌ Use default SSL configurations

---

## 📊 Monitoring SSL/TLS

### Certificate Expiration

**Using Prometheus:**
```yaml
# /etc/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'ssl_exporter'
    static_configs:
      - targets: ['localhost:9219']
    metrics_path: /probe
    params:
      module: [https]
      target: [your-domain.com:443]
```

**Alert Rule:**
```yaml
groups:
  - name: ssl_alerts
    rules:
      - alert: SSLCertificateExpiring
        expr: ssl_cert_not_after{} - time() < 86400 * 30
        for: 1h
        annotations:
          summary: "SSL certificate expiring in 30 days"
```

### SSL/TLS Handshake Failures

Monitor nginx logs:
```bash
# Count SSL errors
tail -f /var/log/nginx/error.log | grep SSL

# Alert on high SSL error rate
```

### Performance Monitoring

```bash
# Monitor SSL overhead
# Compare: HTTP response time vs HTTPS response time
# Should be <10ms difference
```

---

## 🧪 Testing SSL/TLS

### Manual Testing

```bash
# Test SSL connection
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Test SSL protocols
nmap --script ssl-enum-ciphers -p 443 your-domain.com

# Test certificate chain
openssl s_client -showcerts -connect your-domain.com:443

# Test OCSP stapling
openssl s_client -connect your-domain.com:443 -tlsextdebug -status
```

### Automated Testing

```bash
# SSL Labs API
curl "https://api.ssllabs.com/api/v3/analyze?host=your-domain.com"

# testssl.sh
git clone https://github.com/drwetter/testssl.sh.git
cd testssl.sh
./testssl.sh https://your-domain.com
```

### Expected Results

- **SSL Labs Grade**: A or A+
- **TLS Version**: 1.2 and 1.3 only
- **Certificate**: Valid, trusted chain
- **HSTS**: Enabled
- **OCSP Stapling**: Working
- **Forward Secrecy**: Supported

---

## 🚨 Troubleshooting

### Issue: Certificate Not Trusted

**Symptoms:**
- Browsers show "Not Secure"
- `curl` returns certificate verification error

**Solutions:**
```bash
# Check certificate chain
openssl s_client -connect your-domain.com:443 -showcerts

# Verify intermediate certificates included
cat /etc/letsencrypt/live/your-domain.com/fullchain.pem

# Reload nginx
sudo systemctl reload nginx
```

### Issue: Certificate Expired

**Symptoms:**
- Service stops working
- Browser shows "Certificate Expired"

**Solutions:**
```bash
# Renew immediately
sudo certbot renew --force-renewal

# Reload nginx
sudo systemctl reload nginx

# Check auto-renewal
sudo systemctl status certbot.timer
```

### Issue: SSL Handshake Timeout

**Symptoms:**
- Slow connections
- Timeout errors

**Solutions:**
```nginx
# Increase SSL handshake buffer
ssl_buffer_size 8k;

# Tune worker connections
worker_connections 4096;

# Enable session resumption
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
```

### Issue: Mixed Content Warnings

**Symptoms:**
- Browser console shows mixed content warnings

**Solutions:**
```nginx
# Force HTTPS for all resources
add_header Content-Security-Policy "upgrade-insecure-requests";

# Ensure all internal links use HTTPS
proxy_set_header X-Forwarded-Proto $scheme;
```

---

## 📋 Production Checklist

Before going live:

**SSL/TLS Configuration:**
- [ ] Certificate installed and valid
- [ ] Certificate chain complete
- [ ] TLS 1.2 and 1.3 enabled
- [ ] Weak ciphers disabled
- [ ] HSTS header configured
- [ ] OCSP stapling enabled
- [ ] HTTP → HTTPS redirect working

**Monitoring:**
- [ ] Certificate expiration monitoring configured
- [ ] SSL/TLS error alerts set up
- [ ] Performance baseline recorded
- [ ] Log aggregation configured

**Testing:**
- [ ] SSL Labs test passed (A or A+)
- [ ] testssl.sh scan passed
- [ ] All browsers tested
- [ ] Mobile clients tested
- [ ] Certificate renewal tested

**Security:**
- [ ] Private keys secured (chmod 600)
- [ ] Keys not in version control
- [ ] Auto-renewal configured
- [ ] Backup certificates stored securely
- [ ] Security headers verified

---

## 🔄 Certificate Renewal Process

### Automatic Renewal (Let's Encrypt)

Certbot handles this automatically. Verify:

```bash
# Check renewal timer
sudo systemctl status certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run

# Force renewal if needed
sudo certbot renew --force-renewal
```

### Manual Renewal

If using other CA or manual process:

```bash
# 1. Generate CSR
openssl req -new -key your-domain.key -out your-domain.csr

# 2. Submit CSR to CA and receive new certificate

# 3. Install new certificate
sudo cp new-certificate.crt /etc/ssl/certs/your-domain.crt

# 4. Reload nginx
sudo systemctl reload nginx

# 5. Verify
openssl s_client -connect your-domain.com:443 | openssl x509 -noout -dates
```

---

## 📞 Support Resources

- **Let's Encrypt**: https://letsencrypt.org/docs/
- **Mozilla SSL Config Generator**: https://ssl-config.mozilla.org/
- **SSL Labs**: https://www.ssllabs.com/ssltest/
- **testssl.sh**: https://github.com/drwetter/testssl.sh

---

**Last Updated**: System completion
**Next Review**: Before production deployment
