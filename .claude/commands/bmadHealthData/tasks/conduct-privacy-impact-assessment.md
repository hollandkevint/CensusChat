# /conduct-privacy-impact-assessment Task

When this command is used, execute the following task:

# Privacy Impact Assessment Task

## Purpose

To conduct a comprehensive Privacy Impact Assessment (PIA) for healthcare data products, ensuring privacy risks are identified, evaluated, and mitigated throughout the product lifecycle.

## Inputs

- Product requirements document (PRD)
- System architecture documentation
- Data flow diagrams
- Existing privacy policies
- Regulatory requirements (HIPAA, GDPR, state laws)

## Key Activities & Instructions

### 1. Assessment Scope Definition

- **Define Assessment Boundaries**: Clearly identify all systems, processes, and data flows to be assessed
- **Stakeholder Identification**: List all internal and external stakeholders who handle or access data
- **Timeline Establishment**: Set assessment schedule with key milestones
- **<critical_rule>Ensure assessment covers entire data lifecycle from collection to deletion</critical_rule>

### 2. Data Mapping

#### 2.1 Data Inventory
- **Personal Health Information (PHI)**: Document all PHI elements collected, stored, or processed
- **Sensitive Data Categories**: Identify specially protected data (mental health, substance abuse, genetic)
- **Data Sources**: Map where each data element originates
- **Data Volume**: Estimate quantity and growth projections

#### 2.2 Data Flow Analysis
- **Collection Points**: All interfaces where data enters the system
- **Processing Activities**: Transformations, analytics, and computations performed
- **Storage Locations**: Databases, files, caches, and backups
- **Transmission Paths**: All data movement including APIs and exports
- **Access Points**: User interfaces, reports, and data access mechanisms

### 3. Privacy Risk Identification

#### 3.1 Collection Risks
- [ ] Excessive data collection beyond stated purpose
- [ ] Lack of meaningful consent mechanisms
- [ ] Unclear data collection notices
- [ ] Involuntary data collection

#### 3.2 Use and Processing Risks
- [ ] Function creep (expanding use beyond original purpose)
- [ ] Unauthorized secondary uses
- [ ] Algorithmic bias affecting protected groups
- [ ] Re-identification risks in "anonymized" data

#### 3.3 Storage and Security Risks
- [ ] Insufficient encryption standards
- [ ] Excessive retention periods
- [ ] Inadequate access controls
- [ ] Vulnerable storage locations

#### 3.4 Sharing and Disclosure Risks
- [ ] Unauthorized third-party access
- [ ] Cross-border data transfers
- [ ] Insufficient partner vetting
- [ ] Lack of data use agreements

### 4. Risk Analysis and Scoring

For each identified risk:
- **Likelihood Rating**: Rate probability (Low/Medium/High)
- **Impact Assessment**: Evaluate potential harm (Low/Medium/High)
- **Risk Score**: Calculate overall risk level
- **Affected Individuals**: Estimate number of people impacted

### 5. Mitigation Strategy Development

#### 5.1 Technical Controls
- **Encryption**: At-rest and in-transit encryption standards
- **Access Controls**: Role-based access, least privilege principle
- **Anonymization**: De-identification and pseudonymization techniques
- **Audit Logging**: Comprehensive access and modification tracking

#### 5.2 Administrative Controls
- **Privacy Policies**: Clear, comprehensive privacy notices
- **Training Programs**: Privacy awareness for all staff
- **Vendor Management**: BAAs and security assessments
- **Incident Response**: Privacy breach procedures

#### 5.3 Physical Controls
- **Facility Security**: Physical access restrictions
- **Device Management**: Secure handling of devices with PHI
- **Disposal Procedures**: Secure data destruction methods
- **Environmental Controls**: Protection from environmental threats

### 6. Compliance Verification

- **HIPAA Requirements**: Verify all Privacy and Security Rule requirements
- **GDPR Compliance**: Ensure lawful basis and data subject rights
- **State Laws**: Check state-specific privacy requirements
- **Industry Standards**: Align with healthcare industry best practices

### 7. Stakeholder Consultation

- **Legal Review**: Privacy counsel approval
- **Clinical Input**: Healthcare provider perspective
- **Patient Representatives**: Patient privacy concerns
- **Security Team**: Technical security validation
- **<important_note>Document all stakeholder feedback and how it was addressed</important_note>

### 8. Implementation Planning

- **Priority Actions**: High-risk items requiring immediate attention
- **Implementation Timeline**: Phased approach for controls
- **Resource Requirements**: Budget and staffing needs
- **Success Metrics**: KPIs for privacy protection

### 9. Documentation and Reporting

#### 9.1 PIA Report Contents
- Executive Summary
- Assessment Methodology
- Data Flow Diagrams
- Risk Assessment Matrix
- Mitigation Recommendations
- Implementation Roadmap
- Compliance Attestations

#### 9.2 Ongoing Documentation
- **Risk Register**: Living document of privacy risks
- **Control Testing**: Evidence of control effectiveness
- **Change Log**: Updates to privacy practices
- **Training Records**: Privacy training completion

### 10. Review and Approval

- **Privacy Officer Review**: Formal privacy team approval
- **Executive Sign-off**: Leadership acknowledgment of risks
- **Board Reporting**: If required by governance structure
- **External Validation**: Third-party assessment if needed

## Output

- Comprehensive PIA Report
- Risk mitigation implementation plan
- Privacy control requirements
- Ongoing monitoring procedures
- Stakeholder communication materials

## Success Criteria

- All high-risk privacy issues have mitigation plans
- Compliance with all applicable privacy regulations verified
- Stakeholder concerns addressed and documented
- Clear accountability for privacy protection established
- Measurable privacy metrics defined

## Follow-up Actions

- Schedule regular PIA updates (annually or with major changes)
- Implement privacy controls according to roadmap
- Conduct privacy control testing
- Monitor privacy metrics and incidents
- Update PIA based on lessons learned

## Templates and Tools

- PIA questionnaire template
- Risk scoring matrix
- Data flow diagram tools
- Privacy control catalog
- Compliance checklist

## Notes

- PIAs should be conducted early in development and updated regularly
- Consider privacy-by-design principles throughout
- Engage privacy experts for complex assessments
- Document all decisions and rationales for future reference