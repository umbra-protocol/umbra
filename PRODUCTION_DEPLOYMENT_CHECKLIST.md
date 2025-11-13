# Production Deployment Checklist - x402 ZK Payment System

## 🎯 Pre-Deployment (48 hours before)

### Security Audit
- [ ] Run full test suite: `cd testing && npm run test:all`
- [ ] Review fuzz test results (bug rate must be <1%)
- [ ] Verify chaos test passes all scenarios
- [ ] Review code for security vulnerabilities
- [ ] Scan dependencies for known CVEs: `npm audit` and `go mod download && go list -m all | nancy sleuth`
- [ ] Verify no hardcoded secrets in code
- [ ] Review all environment variables

### Configuration
- [ ] Copy `.env.production` and fill in all values
- [ ] Generate strong API keys (min 32 characters)
- [ ] Configure ALLOWED_ORIGINS with actual domains
- [ ] Set up SSL/TLS certificates
- [ ] Configure rate limits appropriate for scale
- [ ] Set database paths
- [ ] Configure backup paths

### Infrastructure
- [ ] Provision production servers (min 2 instances for HA)
- [ ] Set up load balancer (nginx/HAProxy/ALB)
- [ ] Configure firewall rules (only ports 80/443 exposed)
- [ ] Set up DNS records
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Set up alerting (PagerDuty/OpsGenie)
- [ ] Configure log aggregation (ELK/Splunk)

### Cryptography
- [ ] Execute trusted setup ceremony: `cd ceremony && ./automated_setup.sh`
- [ ] Verify ceremony output with drand beacon
- [ ] Backup verification keys to secure location
- [ ] Document ceremony participants and entropy sources
- [ ] Verify circuit integrity: `cd circuits && npm run verify`
- [ ] Test proof generation with known inputs

### Database
- [ ] Set up production database (PostgreSQL recommended over SQLite for scale)
- [ ] Configure database backups (every 4 hours)
- [ ] Test database restore procedure
- [ ] Set up database replication (if using PostgreSQL)
- [ ] Configure WAL mode for data integrity
- [ ] Test database failover

---

## 🔧 Deployment Day

### Pre-Flight Checks (2 hours before)
- [ ] Verify all team members are available
- [ ] Create deployment announcement (notify users of maintenance window)
- [ ] Take full backup of current system
- [ ] Document rollback plan
- [ ] Test rollback procedure in staging
- [ ] Verify monitoring dashboards are accessible
- [ ] Check on-call schedule

### Build Phase
- [ ] Pull latest code from production branch
- [ ] Verify git tag matches release version
- [ ] Build circuits: `cd circuits && npm run build-all`
- [ ] Verify circuit constraint count matches expected
- [ ] Build Solana program: `cd contracts && cargo build-bpf --release`
- [ ] Verify program binary size (<200KB for cost efficiency)
- [ ] Build prover service: `cd prover && go build -o prover`
- [ ] Build Docker images: `cd deploy && docker-compose build`
- [ ] Tag Docker images with version

### Deploy Solana Program
- [ ] Connect to mainnet: `solana config set --url https://api.mainnet-beta.solana.com`
- [ ] Verify wallet has sufficient SOL (min 10 SOL for deployment)
- [ ] Deploy program: `solana program deploy target/deploy/x402_zk_verifier.so`
- [ ] Save program ID to `.env.production`
- [ ] Verify program deployed correctly: `solana program show <PROGRAM_ID>`
- [ ] Test program with devnet first if possible

### Deploy Services
- [ ] Copy production config: `cp .env.production deploy/.env`
- [ ] Start services: `cd deploy && docker-compose up -d`
- [ ] Wait for health checks to pass (2-3 minutes)
- [ ] Verify all containers running: `docker ps`
- [ ] Check logs for errors: `docker-compose logs`

### Smoke Tests
- [ ] Health check passes: `curl https://your-domain.com/health`
- [ ] Generate test proof with known inputs
- [ ] Verify proof on-chain
- [ ] Test rate limiting works
- [ ] Test authentication works
- [ ] Verify monitoring shows data
- [ ] Trigger test alert to verify alerting works

---

## ✅ Post-Deployment (0-4 hours after)

### Immediate Monitoring (First 30 minutes)
- [ ] Monitor error rates (must be <5%)
- [ ] Monitor latency (P95 must be <500ms)
- [ ] Monitor throughput (must handle expected load)
- [ ] Monitor CPU usage (must be <70%)
- [ ] Monitor memory usage (must be <80%)
- [ ] Monitor disk usage (must be <80%)
- [ ] Check for any alerts triggered

### Functional Testing (30 min - 2 hours)
- [ ] Generate 100 test proofs
- [ ] Verify all proofs on-chain
- [ ] Test from multiple clients
- [ ] Test with various input sizes
- [ ] Test rate limiting with burst traffic
- [ ] Test authentication with valid/invalid keys
- [ ] Test CORS from allowed origins

### Performance Validation (2-4 hours)
- [ ] Run load test against production: `PROVER_URL=https://your-domain.com npm run test:load`
- [ ] Verify performance metrics match expectations
- [ ] Check cache hit rate (should be 10-15%)
- [ ] Verify database write performance
- [ ] Monitor for memory leaks
- [ ] Check for goroutine leaks

---

## 📊 Day 1-7 Monitoring

### Daily Checks (First Week)
- [ ] **Day 1**: Review all logs for errors
- [ ] **Day 1**: Check monitoring dashboards every 4 hours
- [ ] **Day 2**: Run stress test to find breaking point
- [ ] **Day 3**: Review cache hit rates and tune if needed
- [ ] **Day 4**: Check database size and cleanup if needed
- [ ] **Day 5**: Review rate limit violations
- [ ] **Day 6**: Run security scan
- [ ] **Day 7**: First weekly backup test

### Metrics to Monitor
- **Error Rate**: Must stay <2%
- **Latency P95**: Must stay <300ms
- **Throughput**: Must handle peak load
- **Cache Hit Rate**: Should be 10-15%
- **CPU Usage**: Should average <60%
- **Memory Usage**: Should average <70%
- **Disk Usage**: Should grow linearly
- **Database Size**: Should stay <10GB for first week

---

## 🚨 Rollback Criteria

Rollback IMMEDIATELY if:
- [ ] Error rate >20% for more than 5 minutes
- [ ] P95 latency >5000ms for more than 10 minutes
- [ ] Invalid proofs detected (ANY occurrence)
- [ ] Security breach detected
- [ ] Data corruption detected
- [ ] Service completely down for >10 minutes

### Rollback Procedure
```bash
# 1. Notify team
echo "ROLLBACK IN PROGRESS" | mail -s "DEPLOYMENT ROLLBACK" team@your-domain.com

# 2. Stop current services
cd deploy
docker-compose down

# 3. Restore previous version
git checkout <PREVIOUS_TAG>
docker-compose up -d --force-recreate

# 4. Verify health
curl https://your-domain.com/health

# 5. Monitor for 30 minutes
# Watch Grafana dashboards

# 6. Post-mortem
# Schedule incident review within 24 hours
```

---

## 🔐 Security Hardening

### Immediately After Deployment
- [ ] Enable firewall rules (block all except 80/443)
- [ ] Configure fail2ban for brute force protection
- [ ] Enable DDoS protection (Cloudflare/AWS Shield)
- [ ] Set up WAF rules
- [ ] Configure security headers (HSTS, CSP, X-Frame-Options)
- [ ] Enable audit logging
- [ ] Set up intrusion detection (OSSEC/Snort)
- [ ] Configure log shipping to secure location

### API Security
- [ ] Rotate API keys
- [ ] Implement API key rotation schedule (every 90 days)
- [ ] Set up API key audit log
- [ ] Configure rate limits per key
- [ ] Set up API key expiration
- [ ] Document API key management procedures

### Database Security
- [ ] Enable encryption at rest
- [ ] Enable SSL for database connections
- [ ] Create limited privilege database user
- [ ] Remove default admin accounts
- [ ] Set up database audit logging
- [ ] Configure automated backups to encrypted storage
- [ ] Test backup encryption

---

## 📈 Scaling Plan

### When to Scale Up
- **Add Prover Instance** if:
  - CPU >70% for 10+ minutes
  - Queue depth >100
  - P95 latency >500ms

- **Add Database Replicas** if:
  - Read queries >1000/second
  - Database CPU >60%

- **Upgrade Server Resources** if:
  - Memory >80% consistently
  - Disk I/O saturated

### Scaling Procedure
```bash
# Horizontal scaling (add instances)
cd deploy
docker-compose up -d --scale prover=3

# Update load balancer
# Add new instances to upstream block

# Verify load distribution
# Check Grafana for balanced traffic
```

---

## 🔄 Maintenance Schedule

### Daily
- [ ] Review error logs
- [ ] Check monitoring dashboards
- [ ] Verify backups completed

### Weekly
- [ ] Run load test
- [ ] Review performance trends
- [ ] Check disk usage
- [ ] Test backup restore
- [ ] Review security logs
- [ ] Update dependency vulnerabilities

### Monthly
- [ ] Run full test suite in production-like environment
- [ ] Review and rotate API keys
- [ ] Audit user access
- [ ] Review incident reports
- [ ] Update documentation
- [ ] Performance optimization review

### Quarterly
- [ ] Security audit
- [ ] Disaster recovery drill
- [ ] Capacity planning review
- [ ] Cost optimization review
- [ ] Update runbooks
- [ ] Team training on incidents

---

## 📝 Documentation Requirements

### Must Have Before Production
- [ ] Architecture diagram
- [ ] API documentation
- [ ] Runbook for common issues
- [ ] Incident response guide
- [ ] Backup/restore procedures
- [ ] Scaling procedures
- [ ] Security policies
- [ ] On-call rotation schedule

### Post-Deployment Documentation
- [ ] Production deployment record
- [ ] Performance baseline metrics
- [ ] Known issues and workarounds
- [ ] Lessons learned
- [ ] Future improvements list

---

## 🎯 Success Criteria

### Week 1 Goals
- ✅ 99% uptime
- ✅ <2% error rate
- ✅ P95 latency <300ms
- ✅ Zero security incidents
- ✅ All backups successful

### Month 1 Goals
- ✅ 99.5% uptime
- ✅ <1% error rate
- ✅ P95 latency <250ms
- ✅ Zero data loss incidents
- ✅ Disaster recovery tested

---

## ✋ Go/No-Go Decision

### ✅ GO if ALL true:
- All tests pass with >95% success rate
- Security audit complete with no critical findings
- All team members available
- Rollback plan tested and documented
- Monitoring and alerting configured and tested
- Backup and restore tested successfully
- Load testing shows system can handle 2x expected traffic
- On-call engineer confirmed and available

### 🛑 NO-GO if ANY true:
- Any test suite failing
- Critical security vulnerabilities unresolved
- Key team members unavailable
- Monitoring not working
- Backup/restore not tested
- Performance concerns in load testing
- No on-call coverage

---

## 📞 Key Contacts

- **Deployment Lead**: [Name/Phone]
- **On-Call Engineer**: [Name/Phone]
- **Security Team**: [Email/Phone]
- **Infrastructure Team**: [Email/Phone]
- **Management**: [Email/Phone]

---

**Deployment Version**: ________
**Deployment Date**: ________
**Deployment Lead**: ________
**Sign-off**: ________ (initials)

**Status**: [ ] GO [ ] NO-GO

---

*This checklist must be completed and signed off before production deployment.*
