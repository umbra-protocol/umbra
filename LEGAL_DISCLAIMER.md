# Legal Disclaimer and Compliance Notice

**Umbra Protocol - Privacy-Preserving Payment Verification**

---

## Important Legal Notice

**READ THIS CAREFULLY BEFORE USING, DEPLOYING, OR INTEGRATING UMBRA PROTOCOL**

This document contains important legal information about Umbra Protocol. By using this software, you acknowledge that you have read, understood, and agree to be bound by these terms.

---

## Software Classification

### What Umbra Protocol Is

Umbra Protocol is a **privacy-preserving verification tool** that uses zero-knowledge cryptography to prove that a payment has occurred without revealing sensitive transaction details.

**Key Characteristics**:
- ✅ Verification tool for existing blockchain transactions
- ✅ Does NOT custody, hold, or transfer user funds
- ✅ Does NOT execute or process payments
- ✅ Does NOT pool or mix cryptocurrency transactions
- ✅ Open-source software under MIT License

### What Umbra Protocol Is NOT

- ❌ NOT a payment processor or financial service
- ❌ NOT a cryptocurrency mixer or tumbler
- ❌ NOT a custodial wallet or exchange
- ❌ NOT a money services business (MSB)
- ❌ NOT a financial institution or bank

---

## Regulatory Considerations

### Compliance Responsibility

**YOU ARE SOLELY RESPONSIBLE** for ensuring your use of Umbra Protocol complies with all applicable laws and regulations in your jurisdiction.

Regulatory requirements vary significantly by:
- Country/jurisdiction
- Business model
- Transaction volume
- Customer type (retail vs. institutional)
- Industry sector

### Potential Regulatory Frameworks

Depending on your jurisdiction and use case, you may need to consider:

#### United States
- **FinCEN** (Financial Crimes Enforcement Network) - Money services business registration
- **SEC** (Securities and Exchange Commission) - If dealing with securities
- **OFAC** (Office of Foreign Assets Control) - Sanctions compliance
- **State-level MSB licenses** - Varies by state
- **Bank Secrecy Act (BSA)** - Anti-money laundering requirements

**State-Specific Considerations**:
Cryptocurrency regulations vary significantly by state. Some states require money transmitter licenses even for non-custodial services. States with specific cryptocurrency frameworks include those with technology-forward regulatory environments. Always consult with legal counsel familiar with your state's specific requirements before commercial deployment.

#### European Union
- **MiCA** (Markets in Crypto-Assets Regulation) - Crypto asset service providers
- **GDPR** (General Data Protection Regulation) - Data protection and privacy
- **5AMLD** (Fifth Anti-Money Laundering Directive) - AML/CFT requirements
- **Payment Services Directive 2 (PSD2)** - Payment services regulation

#### United Kingdom
- **FCA** (Financial Conduct Authority) - Cryptoasset registration
- **MLR 2017** (Money Laundering Regulations) - AML requirements
- **PSR 2017** (Payment Services Regulations) - Payment services

#### Other Jurisdictions
- Consult local financial regulators
- Seek legal counsel familiar with cryptocurrency regulations
- Review anti-money laundering (AML) and counter-terrorist financing (CFT) requirements

### Privacy vs. Anonymity

**Important Distinction**:

**Privacy**: Protection of user data from unauthorized access (what Umbra provides)

**Anonymity**: Complete lack of identity verification (NOT provided by Umbra)

**Umbra Protocol provides privacy, not anonymity.** You can (and in many cases must) implement Know Your Customer (KYC) and identity verification at the application layer while still using Umbra for transaction privacy.

---

## Know Your Customer (KYC) and Anti-Money Laundering (AML)

### Application-Layer Responsibility

Umbra Protocol does NOT include built-in KYC/AML functionality. Implementing these controls is YOUR responsibility:

**Required Actions**:
1. **Identity Verification**: Verify user identities before granting access
2. **Transaction Monitoring**: Monitor for suspicious activity patterns
3. **Record Keeping**: Maintain required transaction records per regulations
4. **Reporting**: File suspicious activity reports (SARs) as required
5. **Sanctions Screening**: Check users against OFAC and other sanctions lists

**Recommended Solutions**:
- Integrate KYC providers: Jumio, Onfido, Sumsub, Persona
- Use transaction monitoring: Chainalysis, Elliptic, CipherTrace
- Implement screening: Dow Jones, ComplyAdvantage, LexisNexis

### Risk-Based Approach

Apply controls proportional to risk:
- **Low Risk**: Basic identity verification
- **Medium Risk**: Enhanced due diligence
- **High Risk**: Senior management approval, ongoing monitoring

---

## Export Control and Cryptography Regulations

### Cryptography Classification

Umbra Protocol implements strong cryptography (Groth16 ZK-SNARKs, EdDSA signatures).

**Potential Restrictions**:
- Some countries restrict or prohibit certain cryptographic technologies
- Export of cryptographic software may require licenses
- Commercial use may have different requirements than personal use

### Jurisdictions with Cryptography Restrictions

**High Restriction** (may prohibit or heavily regulate):
- China
- Russia
- Iran
- North Korea
- Syria
- Cuba

**Moderate Restriction** (may require registration/notification):
- France (declaration to ANSSI)
- Israel (export license for strong crypto)
- India (licensing for certain uses)

**Consult** the Wassenaar Arrangement and your local export control authority.

---

## Sanctions and Prohibited Use

### Prohibited Users

Umbra Protocol may NOT be used by:
- Individuals or entities on OFAC sanctions lists
- Residents of sanctioned countries (as determined by your jurisdiction)
- Persons prohibited from accessing cryptographic technology
- Anyone intending to use the software for illegal activities

### Prohibited Purposes

Umbra Protocol may NOT be used for:
- Money laundering
- Terrorist financing
- Tax evasion
- Sanctions evasion
- Fraud or theft
- Any illegal activity under applicable law

### Responsibility for Screening

**YOU MUST**:
- Screen users against sanctions lists
- Block access from prohibited jurisdictions
- Implement geographic restrictions if required
- Maintain records of screening procedures

---

## Privacy Laws and Data Protection

### GDPR Compliance (European Union)

**Good News**: Zero-knowledge proofs inherently protect personal data.

**Your Responsibilities**:
- Obtain consent for data processing (if required)
- Provide privacy policy explaining ZK proof generation
- Honor data subject rights (access, deletion, portability)
- Implement data protection by design and default
- Conduct Data Protection Impact Assessment (DPIA) if required

### CCPA/CPRA Compliance (California)

**Your Responsibilities**:
- Disclose data collection and use in privacy policy
- Honor consumer rights (access, deletion, opt-out)
- Implement reasonable security measures
- Provide opt-out for sale of personal information (if applicable)

### Other Privacy Regulations

- **LGPD** (Brazil)
- **PIPEDA** (Canada)
- **PDPA** (Singapore)
- **APP** (Australia)

Consult local data protection authorities and legal counsel.

---

## Tax Obligations

### Tax Reporting

**YOU ARE RESPONSIBLE** for:
- Collecting tax information from users (as required)
- Reporting taxable events to tax authorities
- Withholding and remitting taxes (if required)
- Providing tax forms to users (1099, etc.)

### Jurisdictional Variations

- **US**: IRS cryptocurrency tax reporting requirements
- **EU**: VAT considerations for digital services
- **Other**: Consult local tax authorities

**Umbra Protocol does NOT provide tax reporting functionality.** Implement this separately.

---

## Intellectual Property

### Open Source License

Umbra Protocol is released under the **MIT License**.

**You May**:
- Use commercially
- Modify
- Distribute
- Sublicense

**Conditions**:
- Include copyright notice
- Include MIT License text

**Limitations**:
- No warranty
- No liability

### Third-Party Dependencies

Umbra Protocol uses third-party open-source libraries. Review their licenses:
- gnark (Apache 2.0)
- circomlib (GPL-3.0)
- Solana SDK (Apache 2.0)

Ensure compliance with all dependency licenses.

---

## Liability and Warranties

### NO WARRANTY

**THIS SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.**

We do NOT warrant:
- Fitness for a particular purpose
- Merchantability
- Non-infringement
- Accuracy or reliability
- Uninterrupted or error-free operation
- Security against all threats

### LIMITATION OF LIABILITY

**TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR:**

- Direct, indirect, incidental, or consequential damages
- Loss of profits, revenue, or business opportunities
- Loss of data or information
- Cost of substitute services
- Regulatory fines or penalties
- Any damages exceeding $100 USD

### Indemnification

**YOU AGREE TO INDEMNIFY AND HOLD HARMLESS** the Umbra Protocol developers, contributors, and maintainers from any claims, damages, or expenses arising from:

- Your use of the software
- Your violation of laws or regulations
- Your violation of third-party rights
- Your negligence or misconduct

---

## Professional Advice Disclaimer

### Not Legal Advice

This document does NOT constitute legal advice. It is general information only.

**YOU SHOULD CONSULT**:
- Licensed attorneys familiar with cryptocurrency regulations
- Compliance professionals
- Tax advisors
- Regulatory specialists

### Not Financial Advice

Umbra Protocol developers do NOT provide financial, investment, or business advice.

**Consult**:
- Financial advisors
- Investment professionals
- Business consultants

### Not Security Advice

While we provide security documentation, we do NOT guarantee security.

**Consult**:
- Cybersecurity professionals
- Penetration testers
- Security auditors

---

## Insurance and Risk Management

### Recommended Insurance

For commercial deployments, consider:
- **Cybersecurity Insurance**: Covers data breaches and cyberattacks
- **Errors & Omissions Insurance**: Covers professional liability
- **Directors & Officers Insurance**: Protects leadership
- **Crime Insurance**: Covers theft and fraud

### Risk Management

Implement comprehensive risk management:
- Conduct regular risk assessments
- Maintain incident response plans
- Document compliance procedures
- Train staff on legal requirements
- Retain legal counsel on retainer

---

## Jurisdiction-Specific Warnings

### United States

**State Money Transmitter Licenses**: Some states may require licenses even for non-custodial services. Certain states have cryptocurrency-friendly regulatory environments with clear guidance on when licenses are required. However, requirements vary significantly by state, and some states specifically regulate cryptocurrency activities. Consult legal counsel familiar with both federal and state-level requirements.

**OFAC Compliance**: Mandatory. Implement sanctions screening for all users.

**FinCEN MSB Registration**: May be required depending on business model. Privacy-preserving verification tools generally do not constitute money transmission, but legal interpretation varies. Obtain written legal opinion on your specific use case.

**State Compliance Programs**: For operations in states with specific cryptocurrency regulations, implement robust compliance programs including transaction monitoring, suspicious activity reporting, and recordkeeping in accordance with state requirements.

### European Union

**VASP Registration**: Required in many EU member states for crypto businesses.

**MiCA Compliance**: New regulations effective 2024-2025. Review requirements.

### United Kingdom

**FCA Cryptoasset Registration**: Required for cryptoasset businesses operating in UK.

### China

**Cryptocurrency Restrictions**: Cryptocurrency transactions are prohibited. Do not operate in China.

### Other Jurisdictions

Research local laws before deployment. Cryptocurrency regulations change frequently.

---

## Updates to This Disclaimer

**This disclaimer may be updated without notice.**

- Check regularly for updates
- Version history maintained in git
- Material changes will be announced in README.md

**Current Version**: 1.0
**Last Updated**: November 2025
**Next Review**: February 2026

---

## Acceptance of Terms

**BY USING, DEPLOYING, OR INTEGRATING UMBRA PROTOCOL, YOU ACKNOWLEDGE THAT:**

1. You have read and understood this entire disclaimer
2. You accept all risks associated with using cryptographic software
3. You are responsible for legal and regulatory compliance
4. You will not hold Umbra Protocol developers liable for your actions
5. You will use the software lawfully and ethically
6. You will implement appropriate KYC/AML controls
7. You will consult legal professionals before commercial deployment
8. You understand this is experimental software
9. You accept that regulations may change
10. You agree to these terms voluntarily

**IF YOU DO NOT AGREE, DO NOT USE THIS SOFTWARE.**

---

## Contact for Legal Matters

**Legal Inquiries**: legal@umbra-protocol.io
**Compliance Questions**: compliance@umbra-protocol.io
**General Contact**: hello@umbra-protocol.io

**Response Time**: 5-7 business days for legal matters

---

## Final Reminders

### Before Going to Production

- [ ] Consult with legal counsel
- [ ] Conduct regulatory compliance review
- [ ] Implement KYC/AML procedures
- [ ] Obtain necessary licenses/registrations
- [ ] Set up tax reporting systems
- [ ] Implement sanctions screening
- [ ] Purchase appropriate insurance
- [ ] Document all compliance procedures
- [ ] Train staff on legal requirements
- [ ] Establish ongoing compliance monitoring

### Ongoing Responsibilities

- Monitor regulatory changes
- Update compliance procedures
- Maintain detailed records
- File required reports
- Renew licenses/registrations
- Conduct annual compliance audits
- Review and update privacy policies
- Train new staff on compliance

---

**DISCLAIMER**: This document is provided for informational purposes only and does not constitute legal advice. Laws and regulations vary by jurisdiction and change frequently. Always consult with qualified legal professionals before deploying cryptocurrency-related technologies in production environments.

**REMEMBER**: You are responsible for your own compliance. Ignorance of the law is not a defense.

---

*This disclaimer applies to Umbra Protocol and all associated documentation.*

*MIT License applies to the software itself. This legal disclaimer provides additional context and obligations for users.*

*© 2025 Umbra Protocol Contributors*
