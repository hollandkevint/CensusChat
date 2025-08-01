# Data Quality Checklist

**Purpose**: Ensure data quality meets enterprise standards for B2B data products  
**Agent**: data-trust-specialist, data-ops-engineer  
**Frequency**: Daily monitoring, weekly review, monthly audit  
**Target Quality**: 99.5%+ accuracy, 95%+ completeness

## Data Accuracy

### Source Data Validation
- [ ] **Source Verification**: All data sources verified and authenticated
- [ ] **Data Collection Methods**: Collection procedures documented and validated
- [ ] **Sampling Methodology**: Statistical sampling methods appropriate and documented
- [ ] **Data Entry Validation**: Data entry processes include validation rules
- [ ] **Automated Checks**: Automated accuracy checks implemented at ingestion
- [ ] **Manual Spot Checks**: Regular manual verification of critical data points
- [ ] **Third-party Validation**: External validation of key data elements when possible
- [ ] **Error Rate Tracking**: Error rates measured and tracked over time

### Data Processing Validation
- [ ] **Transformation Logic**: Data transformation rules documented and tested
- [ ] **Calculation Verification**: All calculated fields verified against source systems
- [ ] **Aggregation Accuracy**: Aggregated data matches detailed data summations
- [ ] **Join Integrity**: Data joins maintain referential integrity
- [ ] **Deduplication Logic**: Duplicate record handling logic tested and verified
- [ ] **Data Type Consistency**: Data types consistent across all processing stages
- [ ] **Format Standardization**: Data formats standardized and validated
- [ ] **Business Rule Compliance**: Data processing follows defined business rules

## Data Completeness

### Field-Level Completeness
- [ ] **Required Fields**: All required fields have >95% completion rate
- [ ] **Critical Fields**: Business-critical fields have >99% completion rate
- [ ] **Optional Fields**: Optional field completion rates documented
- [ ] **Default Values**: Appropriate default values set for missing data
- [ ] **Null Value Handling**: Null value policies documented and implemented
- [ ] **Missing Data Patterns**: Missing data patterns analyzed and documented
- [ ] **Imputation Methods**: Data imputation methods documented where used
- [ ] **Completion Trends**: Data completion trends monitored over time

### Record-Level Completeness
- [ ] **Record Coverage**: Universe coverage documented and meets targets
- [ ] **Geographic Coverage**: Geographic coverage complete for target markets
- [ ] **Temporal Coverage**: Historical coverage meets customer requirements
- [ ] **Entity Coverage**: All target entities included in dataset
- [ ] **Relationship Completeness**: Entity relationships captured completely
- [ ] **Cross-Reference Completeness**: Cross-reference tables complete
- [ ] **Update Completeness**: All updates captured and processed
- [ ] **Archival Completeness**: Historical records maintained appropriately

## Data Consistency

### Internal Consistency
- [ ] **Field Consistency**: Same data elements consistent across records
- [ ] **Format Consistency**: Data formats consistent within fields
- [ ] **Scale Consistency**: Measurement scales consistent across similar fields
- [ ] **Coding Consistency**: Classification codes applied consistently
- [ ] **Naming Consistency**: Entity names standardized across records
- [ ] **Date Consistency**: Date formats and time zones consistent
- [ ] **Currency Consistency**: Currency values and codes consistent
- [ ] **Unit Consistency**: Measurement units consistent and documented

### Cross-Source Consistency
- [ ] **Source Reconciliation**: Data consistent across multiple sources
- [ ] **Version Alignment**: Different data versions properly aligned
- [ ] **Integration Consistency**: Integrated data maintains source consistency
- [ ] **Update Synchronization**: Updates applied consistently across sources
- [ ] **Master Data Management**: Master data records consistent across systems
- [ ] **Reference Data Alignment**: Reference data consistent across sources
- [ ] **Business Rule Consistency**: Business rules applied consistently
- [ ] **Temporal Consistency**: Time-series data temporally consistent

## Data Timeliness

### Update Frequency
- [ ] **Scheduled Updates**: Data updates occur on documented schedule
- [ ] **Update Monitoring**: Update completion monitored and verified
- [ ] **Delay Tracking**: Update delays tracked and minimized
- [ ] **Real-time Requirements**: Real-time update requirements met where needed
- [ ] **Batch Processing**: Batch processing completed within SLA windows
- [ ] **Priority Updates**: High-priority updates processed immediately
- [ ] **Rollback Procedures**: Update rollback procedures tested and ready
- [ ] **Update Notifications**: Stakeholders notified of update completion

### Data Freshness
- [ ] **Freshness Indicators**: Data freshness clearly indicated to users
- [ ] **Age Thresholds**: Data age thresholds defined and monitored
- [ ] **Staleness Alerts**: Automated alerts for stale data implemented
- [ ] **Source Lag Monitoring**: Source system lag times monitored
- [ ] **Processing Time Tracking**: Data processing times tracked and optimized
- [ ] **User Expectations**: User expectations for freshness clearly communicated
- [ ] **SLA Compliance**: Data freshness SLAs met consistently
- [ ] **Historical Preservation**: Historical data preserved appropriately

## Data Validity

### Business Rule Validation
- [ ] **Business Logic**: All business rules properly implemented in validation
- [ ] **Domain Constraints**: Domain-specific constraints enforced
- [ ] **Range Validation**: Numeric ranges validated against business rules
- [ ] **List Validation**: Enumerated values validated against approved lists
- [ ] **Pattern Validation**: Data patterns validated (e.g., phone numbers, emails)
- [ ] **Cross-Field Validation**: Cross-field validations implemented
- [ ] **Conditional Logic**: Conditional validation rules properly implemented
- [ ] **Exception Handling**: Business rule exceptions properly handled

### Technical Validation
- [ ] **Data Type Validation**: Data types match schema definitions
- [ ] **Format Validation**: Data formats match specified patterns
- [ ] **Length Validation**: Field lengths within specified limits
- [ ] **Character Set Validation**: Character encoding consistent and valid
- [ ] **Structure Validation**: Data structure matches schema requirements
- [ ] **Relationship Validation**: Referential integrity maintained
- [ ] **Constraint Validation**: Database constraints properly enforced
- [ ] **Schema Compliance**: Data complies with defined schema

## Data Quality Monitoring

### Automated Monitoring
- [ ] **Quality Dashboards**: Real-time data quality dashboards operational
- [ ] **Automated Alerts**: Quality threshold alerts configured and active
- [ ] **Quality Scoring**: Automated quality scoring implemented
- [ ] **Trend Analysis**: Quality trend analysis automated
- [ ] **Exception Reporting**: Automated exception and anomaly reporting
- [ ] **Performance Monitoring**: Data quality performance continuously monitored
- [ ] **Threshold Management**: Quality thresholds regularly reviewed and updated
- [ ] **Escalation Procedures**: Quality issue escalation procedures automated

### Manual Review Processes
- [ ] **Regular Audits**: Scheduled manual quality audits conducted
- [ ] **Sampling Reviews**: Statistical sampling reviews performed
- [ ] **Customer Feedback**: Customer quality feedback collected and analyzed
- [ ] **Expert Review**: Subject matter expert reviews conducted
- [ ] **Comparative Analysis**: Quality compared against external benchmarks
- [ ] **Root Cause Analysis**: Quality issues analyzed for root causes
- [ ] **Improvement Planning**: Quality improvement plans developed and executed
- [ ] **Documentation Updates**: Quality procedures updated based on findings

## Quality Improvement

### Continuous Improvement
- [ ] **Quality Metrics**: Comprehensive quality metrics tracked over time
- [ ] **Improvement Targets**: Specific quality improvement targets set
- [ ] **Action Plans**: Quality improvement action plans developed
- [ ] **Resource Allocation**: Adequate resources allocated to quality improvement
- [ ] **Technology Upgrades**: Technology upgrades planned to improve quality
- [ ] **Process Optimization**: Data processes continuously optimized
- [ ] **Training Programs**: Staff training programs for quality improvement
- [ ] **Best Practices**: Industry best practices adopted and implemented

### Quality Assurance
- [ ] **QA Procedures**: Formal quality assurance procedures documented
- [ ] **Testing Protocols**: Data quality testing protocols implemented
- [ ] **Validation Procedures**: Multi-stage validation procedures active
- [ ] **Approval Processes**: Quality approval processes before data release
- [ ] **Quality Gates**: Quality gates implemented in data pipeline
- [ ] **Certification Processes**: Data quality certification processes active
- [ ] **Compliance Verification**: Regulatory compliance verified regularly
- [ ] **Customer Validation**: Customer validation of quality levels obtained

## Quality Reporting

### Internal Reporting
- [ ] **Executive Reports**: Quality metrics reported to executive leadership
- [ ] **Operational Reports**: Daily/weekly operational quality reports
- [ ] **Trend Reports**: Quality trend reports generated regularly
- [ ] **Exception Reports**: Quality exception reports distributed promptly
- [ ] **Improvement Reports**: Quality improvement progress reported
- [ ] **Benchmark Reports**: Quality benchmarking reports generated
- [ ] **Cost Reports**: Quality cost and ROI reports provided
- [ ] **Training Reports**: Quality training effectiveness reported

### Customer Communication
- [ ] **Quality Transparency**: Data quality levels transparently communicated
- [ ] **Quality Documentation**: Quality methodologies documented for customers
- [ ] **Issue Communication**: Quality issues communicated promptly
- [ ] **Improvement Communication**: Quality improvements communicated
- [ ] **SLA Reporting**: Quality SLA performance reported regularly
- [ ] **Certification Sharing**: Quality certifications shared with customers
- [ ] **Feedback Loops**: Customer quality feedback loops established
- [ ] **Resolution Updates**: Quality issue resolution status communicated

---

**Current Quality Score**: ___% (Target: 99.5%+)  
**Quality Trends**: [ ] Improving [ ] Stable [ ] Declining  
**Critical Issues**: [ ] None [ ] Minor [ ] Major  
**Next Review Date**: _____________  
**Quality Officer**: _____________