# Incident Response Guide - x402 ZK Payment System

## 🚨 Emergency Contacts

**On-Call Engineer**: [Phone/Pager]
**Backup Engineer**: [Phone/Pager]
**Security Team**: security@your-domain.com
**Infrastructure Team**: infra@your-domain.com

**Escalation Policy**:
1. On-call engineer (respond within 15 min)
2. Backup engineer (if no response after 30 min)
3. Team lead (after 1 hour)

---

## 📋 Incident Severity Levels

### **P0 - Critical** (Immediate response required)
- Complete service outage
- Data breach or security compromise
- Proof verification returning incorrect results
- Cryptographic key compromise

**Response Time**: < 15 minutes
**Resolution Target**: < 4 hours

### **P1 - High** (Urgent response required)
- Partial service degradation (>20% error rate)
- High latency (>5 seconds)
- Rate of proof generation drops below 10 req/s
- Database corruption

**Response Time**: < 1 hour
**Resolution Target**: < 24 hours

### **P2 - Medium**
- Elevated error rates (5-20%)
- Performance degradation (1-5s latency)
- Non-critical component failure
- Monitoring alerts

**Response Time**: < 4 hours
**Resolution Target**: < 3 days

### **P3 - Low**
- Minor issues not affecting service
- Feature requests
- Documentation issues

**Response Time**: < 1 business day
**Resolution Target**: Best effort

---

## 🔍 Common Incidents & Resolutions

### Incident 1: Service Down / Not Responding

**Symptoms:**
- Health check endpoint returns 5xx errors
- No response from prover service
- Grafana shows service as down

**Diagnosis:**
```bash
# Check if service is running
docker ps | grep prover

# Check service logs
docker logs x402-prover-1 --tail=100

# Check system resources
docker stats
```

**Resolution:**

**Quick Fix (Restart Service):**
```bash
cd deploy
docker-compose restart prover
```

**If restart fails:**
```bash
# Check for port conflicts
netstat -an | findstr :8080

# Check for resource exhaustion
docker stats

# Review error logs
docker logs x402-prover-1 --tail=500 > incident_logs.txt

# Force recreate container
docker-compose up -d --force-recreate prover
```

**Prevention:**
- Set up automated health check restarts
- Configure resource limits
- Enable swap space for memory spikes

---

### Incident 2: High Error Rate (>20%)

**Symptoms:**
- Grafana shows error rate >20%
- Proof generation failing
- Rate limit violations increasing

**Diagnosis:**
```bash
# Check error types in logs
docker logs x402-prover-1 | grep "ERROR"

# Check Prometheus metrics
curl http://localhost:8080/metrics | grep proof_generation_errors

# Check database health
sqlite3 proofs.db "PRAGMA integrity_check;"
```

**Resolution:**

**If input validation errors:**
```bash
# Review recent failed requests
docker logs x402-prover-1 | grep "validation failed" --tail=50

# Check for malicious traffic
docker logs x402-prover-1 | grep "rate_limit" --tail=50

# Consider blocking abusive IPs in firewall
```

**If circuit errors:**
```bash
# Verify circuit integrity
cd circuits
npm run verify

# Regenerate proving keys if corrupted
cd ceremony
./automated_setup.sh
```

**If database errors:**
```bash
# Check database integrity
sqlite3 proofs.db "PRAGMA integrity_check;"

# Restore from backup
cd prover
go run restore.go --backup=backups/proofs_backup_YYYY-MM-DD.db
```

**Prevention:**
- Set up input validation monitoring
- Configure circuit verification on startup
- Automate database integrity checks

---

### Incident 3: Slow Performance (<5 req/s)

**Symptoms:**
- Proof generation >10 seconds
- P95 latency >5000ms
- Queue building up

**Diagnosis:**
```bash
# Check current throughput
curl http://localhost:8080/metrics | grep proof_generation_duration

# Check CPU/memory usage
docker stats

# Check database size
ls -lh proofs.db
```

**Resolution:**

**If CPU bottleneck:**
```bash
# Scale horizontally (add more instances)
cd deploy
docker-compose up -d --scale prover=3

# Update load balancer to distribute traffic
```

**If memory bottleneck:**
```bash
# Reduce cache size
export CACHE_SIZE=1000
docker-compose restart prover

# Clear old cached proofs
sqlite3 proofs.db "DELETE FROM proofs WHERE expires_at < datetime('now');"
```

**If database bloat:**
```bash
# Vacuum database
sqlite3 proofs.db "VACUUM;"

# Clean up old records
sqlite3 proofs.db "DELETE FROM proofs WHERE created_at < datetime('now', '-7 days');"
```

**Prevention:**
- Configure auto-scaling based on CPU >70%
- Set up database cleanup cron jobs
- Monitor queue depth

---

### Incident 4: Invalid Proofs Generated

**🚨 CRITICAL - P0 INCIDENT**

**Symptoms:**
- On-chain verification failing
- Proofs rejected by Solana program
- Circuit verification errors

**Immediate Actions:**
1. **STOP SERVICE IMMEDIATELY**
```bash
docker-compose down
```

2. **Notify Security Team**
```bash
# Send alert
echo "CRITICAL: Invalid proofs detected" | mail -s "P0 INCIDENT" security@your-domain.com
```

3. **Preserve Evidence**
```bash
# Backup current state
cp proofs.db proofs_incident_$(date +%s).db
docker logs x402-prover-1 > incident_prover_$(date +%s).log
```

**Root Cause Analysis:**
```bash
# Verify circuit integrity
cd circuits
npm run verify

# Check verification keys
diff verification_key.json backup/verification_key.json

# Test proof generation with known inputs
npm run test:circuit
```

**Resolution:**

**If circuit corruption:**
```bash
# Restore from trusted backup
cp backup/payment_proof.circom circuits/
cd circuits
npm run build-all

# Verify circuit output
npm run test:circuit
```

**If key corruption:**
```bash
# Regenerate keys from trusted ceremony
cd ceremony
./automated_setup.sh

# Deploy new keys
cd ../deploy
./deploy.sh
```

**If code bug:**
```bash
# Rollback to last known good version
git revert HEAD
docker-compose up -d --build
```

**Post-Incident:**
1. Audit all proofs generated during incident period
2. Notify affected users
3. Document root cause
4. Implement additional safeguards
5. Run comprehensive test suite

---

### Incident 5: Database Corruption

**Symptoms:**
- SQLite integrity check fails
- Database query errors
- Service crashes on startup

**Diagnosis:**
```bash
# Check database integrity
sqlite3 proofs.db "PRAGMA integrity_check;"

# Check database file
file proofs.db

# Check for disk errors
fsck /dev/sda1  # Linux
# or check Event Viewer on Windows
```

**Resolution:**

**If minor corruption:**
```bash
# Try to repair
sqlite3 proofs.db "PRAGMA integrity_check;"
sqlite3 proofs.db "REINDEX;"
sqlite3 proofs.db "VACUUM;"
```

**If major corruption:**
```bash
# Restore from most recent backup
cd prover/backups
ls -lt | head -5

# Restore
cp proofs_backup_YYYY-MM-DD.db ../proofs.db
docker-compose restart prover
```

**If no backup available:**
```bash
# Create new database (LAST RESORT)
rm proofs.db
docker-compose restart prover
# New schema will be initialized
```

**Prevention:**
- Enable database WAL mode
- Set up automated backups every 4 hours
- Use checksums for database validation

---

### Incident 6: Rate Limit Bypass / DDoS

**Symptoms:**
- High request volume from single IP
- Service overloaded
- Legitimate users unable to access

**Immediate Actions:**
```bash
# Identify attacking IPs
docker logs x402-prover-1 | grep "rate_limit" | awk '{print $X}' | sort | uniq -c | sort -rn

# Block at firewall level
iptables -A INPUT -s <ATTACKING_IP> -j DROP

# Or block in nginx
echo "deny <ATTACKING_IP>;" >> /etc/nginx/blocked_ips.conf
nginx -s reload
```

**Resolution:**

**Enable additional rate limiting:**
```bash
# Update rate limits
export RATE_LIMIT_PER_MINUTE=5
docker-compose restart prover

# Enable Cloudflare or similar DDoS protection
```

**Add WAF rules:**
```bash
# Configure Web Application Firewall
# Block based on:
# - Geographic location
# - User-agent patterns
# - Request patterns
```

**Prevention:**
- Use Cloudflare or AWS Shield
- Implement progressive rate limits
- Set up anomaly detection

---

### Incident 7: Memory Leak

**Symptoms:**
- Memory usage grows over time
- OOM errors
- Service becomes unresponsive

**Diagnosis:**
```bash
# Monitor memory over time
docker stats --no-stream

# Check for goroutine leaks
curl http://localhost:8080/debug/pprof/goroutine

# Profile memory
curl http://localhost:8080/debug/pprof/heap > heap.prof
go tool pprof heap.prof
```

**Resolution:**

**Immediate (Restart):**
```bash
docker-compose restart prover
```

**Long-term fix:**
```bash
# Review code for leaks
# Check for:
# - Unclosed database connections
# - Growing caches without bounds
# - Goroutine leaks

# Set memory limits
docker-compose.yml:
  prover:
    deploy:
      resources:
        limits:
          memory: 4G
```

**Prevention:**
- Set up memory usage alerts (>80%)
- Enable automatic restarts on high memory
- Profile memory usage regularly

---

## 📊 Incident Response Checklist

### Detection Phase
- [ ] Alert received and acknowledged
- [ ] Incident severity assessed
- [ ] On-call engineer notified
- [ ] Incident logged in tracking system

### Response Phase
- [ ] Service health checked
- [ ] Logs collected and reviewed
- [ ] Metrics analyzed (Grafana/Prometheus)
- [ ] Root cause identified

### Mitigation Phase
- [ ] Immediate fix applied
- [ ] Service restored
- [ ] Verification performed
- [ ] Users notified (if applicable)

### Recovery Phase
- [ ] Long-term fix implemented
- [ ] Monitoring improved
- [ ] Documentation updated
- [ ] Post-mortem scheduled

### Post-Incident Phase
- [ ] Post-mortem completed
- [ ] Action items assigned
- [ ] Preventive measures implemented
- [ ] Runbook updated

---

## 🔧 Useful Commands

### Service Management
```bash
# Restart all services
docker-compose restart

# View all logs
docker-compose logs -f

# Scale prover service
docker-compose up -d --scale prover=3

# Check service health
curl http://localhost:8080/health
```

### Database Operations
```bash
# Database integrity check
sqlite3 proofs.db "PRAGMA integrity_check;"

# Backup database
cp proofs.db proofs_backup_$(date +%s).db

# Restore database
cp proofs_backup_TIMESTAMP.db proofs.db

# Cleanup expired proofs
sqlite3 proofs.db "DELETE FROM proofs WHERE expires_at < datetime('now');"
```

### Monitoring
```bash
# View metrics
curl http://localhost:8080/metrics

# Check Prometheus
curl http://localhost:9090/api/v1/query?query=proof_generation_duration_seconds

# Grafana dashboard
open http://localhost:3001
```

### Circuit Operations
```bash
# Verify circuit
cd circuits && npm run verify

# Regenerate keys
cd ceremony && ./automated_setup.sh

# Test circuit
npm run test:circuit
```

---

## 📞 Post-Incident Review

After every P0/P1 incident, conduct a blameless post-mortem:

1. **Timeline**: Document what happened and when
2. **Root Cause**: Identify the underlying cause
3. **Impact**: Quantify user/business impact
4. **Detection**: How was the incident detected?
5. **Response**: What actions were taken?
6. **Resolution**: How was it fixed?
7. **Prevention**: What can prevent this in the future?
8. **Action Items**: Assign specific tasks with owners and deadlines

**Template**: Use `incident_postmortem_template.md`

---

## 🔐 Security Incidents

For security-related incidents:

1. **DO NOT** restart services immediately (preserve evidence)
2. **DO** notify security team immediately
3. **DO** preserve logs and database state
4. **DO** follow security incident response protocol
5. **DO** coordinate with legal team if data breach

**Security Hotline**: security@your-domain.com
**Legal Team**: legal@your-domain.com

---

**Last Updated**: System completion
**Next Review**: Quarterly
**Owner**: Infrastructure Team
