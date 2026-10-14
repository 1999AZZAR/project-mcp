export class PromptHandlers {
  async handleGetPrompt(name: string, args: Record<string, any>): Promise<string> {
    try {
      // Project management prompts
      if (['project-setup', 'sprint-planning', 'progress-update', 'retrospective'].includes(name)) {
        return await this.handleProjectManagementPrompt(name, args);
      }

      // Quality and process prompts
      if (['code-review', 'bug-tracking', 'technical-debt-assessment'].includes(name)) {
        return await this.handleQualityPrompt(name, args);
      }

      // Management prompts
      if (['team-productivity', 'resource-allocation', 'stakeholder-communication', 'documentation-management', 'change-management'].includes(name)) {
        return await this.handleManagementPrompt(name, args);
      }

      // Planning prompts
      if (['requirements-gathering', 'user-story-management', 'testing-strategy', 'security-assessment', 'performance-optimization'].includes(name)) {
        return await this.handlePlanningPrompt(name, args);
      }

      // Advanced prompts
      if (['ci-cd-setup', 'architecture-review', 'cost-management', 'customer-feedback', 'innovation-planning', 'incident-response', 'knowledge-transfer', 'vendor-management'].includes(name)) {
        return await this.handleAdvancedPrompt(name, args);
      }

      throw new Error(`Unknown prompt: ${name}`);
    } catch (error) {
      throw new Error(`Prompt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleProjectManagementPrompt(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case 'project-setup':
        return this.generateProjectSetupPrompt(args);
      case 'sprint-planning':
        return this.generateSprintPlanningPrompt(args);
      case 'progress-update':
        return this.generateProgressUpdatePrompt(args);
      case 'retrospective':
        return this.generateRetrospectivePrompt(args);
      default:
        throw new Error(`Unknown project management prompt: ${name}`);
    }
  }

  private async handleQualityPrompt(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case 'code-review':
        return this.generateCodeReviewPrompt(args);
      case 'bug-tracking':
        return this.generateBugTrackingPrompt(args);
      case 'technical-debt-assessment':
        return this.generateTechnicalDebtPrompt(args);
      default:
        throw new Error(`Unknown quality prompt: ${name}`);
    }
  }

  private async handleManagementPrompt(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case 'team-productivity':
        return this.generateTeamProductivityPrompt(args);
      case 'resource-allocation':
        return this.generateResourceAllocationPrompt(args);
      case 'stakeholder-communication':
        return this.generateStakeholderCommunicationPrompt(args);
      case 'documentation-management':
        return this.generateDocumentationManagementPrompt(args);
      case 'change-management':
        return this.generateChangeManagementPrompt(args);
      default:
        throw new Error(`Unknown management prompt: ${name}`);
    }
  }

  private async handlePlanningPrompt(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case 'requirements-gathering':
        return this.generateRequirementsGatheringPrompt(args);
      case 'user-story-management':
        return this.generateUserStoryManagementPrompt(args);
      case 'testing-strategy':
        return this.generateTestingStrategyPrompt(args);
      case 'security-assessment':
        return this.generateSecurityAssessmentPrompt(args);
      case 'performance-optimization':
        return this.generatePerformanceOptimizationPrompt(args);
      default:
        throw new Error(`Unknown planning prompt: ${name}`);
    }
  }

  private async handleAdvancedPrompt(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
      case 'ci-cd-setup':
        return this.generateCICDSetupPrompt(args);
      case 'architecture-review':
        return this.generateArchitectureReviewPrompt(args);
      case 'cost-management':
        return this.generateCostManagementPrompt(args);
      case 'customer-feedback':
        return this.generateCustomerFeedbackPrompt(args);
      case 'innovation-planning':
        return this.generateInnovationPlanningPrompt(args);
      case 'incident-response':
        return this.generateIncidentResponsePrompt(args);
      case 'knowledge-transfer':
        return this.generateKnowledgeTransferPrompt(args);
      case 'vendor-management':
        return this.generateVendorManagementPrompt(args);
      default:
        throw new Error(`Unknown advanced prompt: ${name}`);
    }
  }

  private generateProjectSetupPrompt(args: Record<string, any>): string {
    const projectName = args.project_name || 'New Project';
    const teamMembers = args.team_members ? args.team_members.split(',').map((m: string) => m.trim()) : [];

    return `# Project Setup Guide for "${projectName}"

## Overview
This guide will help you set up a new project in Project Guardian with proper entity structure and relationships.

## Steps to Follow:

### 1. Create Project Entity
\`\`\`typescript
await create_entity({
  entities: [{
    name: "${projectName.toLowerCase().replace(/\s+/g, '_')}",
    entityType: "project",
    observations: [
      "Main project container",
      "Started: ${new Date().toISOString().split('T')[0]}",
      ${teamMembers.length > 0 ? `"Team: ${teamMembers.join(', ')}"` : ''}
    ]
  }]
});
\`\`\`

### 2. Set Up Initial Project Structure
Based on your project type, create relevant entities and relationships.

### 3. Establish Team Ownership
${teamMembers.length > 0 ? `Create relationships between team members and the project.` : 'Add team members as needed.'}

## Next Steps
- Add initial tasks and milestones
- Set up project dependencies
- Begin tracking progress

Remember to use \`read_graph\` regularly to view your project structure!`;
  }

  private generateSprintPlanningPrompt(args: Record<string, any>): string {
    const sprintName = args.sprint_name || 'Sprint';
    const duration = args.duration_days || 14;

    return `# Sprint Planning Guide for "${sprintName}"

## Sprint Overview
- **Name**: ${sprintName}
- **Duration**: ${duration} days
- **Goal**: Deliver planned features and improvements

## Planning Steps:

### 1. Review Current Project State
\`\`\`typescript
const graph = await read_graph();
// Analyze current tasks and progress
\`\`\`

### 2. Create Sprint Entity
\`\`\`typescript
await create_entity({
  entities: [{
    name: "${sprintName.toLowerCase().replace(/\s+/g, '_')}",
    entityType: "milestone",
    observations: [
      "Sprint planning: ${new Date().toISOString().split('T')[0]}",
      "Duration: ${duration} days",
      "Status: planning"
    ]
  }]
});
\`\`\`

### 3. Add Sprint Tasks
Create task entities for this sprint and link them to the sprint milestone.

### 4. Set Dependencies
Use \`create_relation\` to establish task dependencies.

## Sprint Execution
- Daily standups (track in observations)
- Regular progress updates
- End-of-sprint retrospective

Track everything in Project Guardian for visibility and accountability!`;
  }

  private generateProgressUpdatePrompt(args: Record<string, any>): string {
    const taskName = args.task_name || 'task';
    const progressNotes = args.progress_notes || 'Progress update';

    return `# Progress Update Guide for "${taskName}"

## Overview
Update progress on "${taskName}" with notes: "${progressNotes}"

## Update Process:

### 1. Locate Task
\`\`\`typescript
const searchResult = await search_nodes("${taskName}");
const taskDetails = await open_node(["${taskName}"]);
\`\`\`

### 2. Add Progress Observation
\`\`\`typescript
await add_observation({
  observations: [{
    entityName: "${taskName}",
    contents: [
      "${progressNotes}",
      "Updated: ${new Date().toLocaleDateString()}",
      "Status: [In Progress/Completed/Blocked]"
    ]
  }]
});
\`\`\`

### 3. Update Dependencies
Check if this progress unblocks other tasks.

### 4. Verify Impact
Use \`read_graph\` to see broader project impact.

Track progress consistently for accurate project visibility!`;
  }

  private generateRetrospectivePrompt(args: Record<string, any>): string {
    const timePeriod = args.time_period || 'recent period';

    return `# Retrospective Guide for ${timePeriod}

## Overview
Conduct a comprehensive retrospective for ${timePeriod} to identify improvements.

## Retrospective Process:

### 1. Gather Data
\`\`\`typescript
const graph = await read_graph();
const searchResults = await search_nodes("[relevant terms]");
\`\`\`

### 2. Analyze What Went Well
Document successes and positive patterns.

### 3. Identify Challenges
Record issues and obstacles encountered.

### 4. Create Improvement Actions
\`\`\`typescript
await create_entity({
  entities: [{
    name: "improvement_[name]",
    entityType: "task",
    observations: [
      "Improvement from ${timePeriod} retrospective",
      "Issue: [what was challenging]",
      "Solution: [proposed improvement]",
      "Owner: [responsible person]"
    ]
  }]
});
\`\`\`

### 5. Plan Implementation
Assign owners and timelines for improvements.

## Next Steps
- Schedule follow-up reviews
- Track implementation progress
- Measure impact of changes

Use retrospectives to continuously improve processes!`;
  }

  private generateCodeReviewPrompt(args: Record<string, any>): string {
    const prTitle = args.pull_request_title || 'Code Changes';
    const reviewer = args.reviewer_name || 'Reviewer';

    return `# Code Review Guide for "${prTitle}"

## Overview
Conduct comprehensive code review as ${reviewer}.

## Review Checklist:

### Architecture & Design
- Code follows project patterns
- Design is clean and maintainable
- Appropriate abstractions used

### Functionality
- Implements requirements correctly
- Edge cases handled
- Error handling comprehensive

### Performance
- Efficient algorithms used
- No performance concerns
- Memory leaks addressed

### Security
- Input validation present
- Authentication/authorization checked
- Sensitive data handled properly

### Quality
- Unit tests added/updated
- Code comments added
- Documentation updated

## Review Process:
1. Create review entity in Project Guardian
2. Document findings as separate entities
3. Link findings to review with relationships
4. Provide approval decision with observations

Track all code review activities for audit and improvement!`;
  }

  private generateBugTrackingPrompt(args: Record<string, any>): string {
    const bugDesc = args.bug_description || 'Software Bug';
    const severity = args.severity_level || 'Medium';

    return `# Bug Tracking Guide for "${bugDesc}"

## Overview
Track and manage ${severity} severity bug.

## Bug Management Process:

### 1. Create Bug Entity
\`\`\`typescript
await create_entity({
  entities: [{
    name: "bug_${Date.now()}",
    entityType: "risk",
    observations: [
      "${bugDesc}",
      "Severity: ${severity}",
      "Status: Open",
      "Reproduction Steps: [steps to reproduce]",
      "Expected: [expected behavior]",
      "Actual: [actual behavior]"
    ]
  }]
});
\`\`\`

### 2. Link to Affected Components
Connect bug to impacted features/tasks.

### 3. Assign Investigation
Set ownership for bug investigation.

### 4. Track Resolution Progress
Update observations as work progresses.

### 5. Validate Fix
Ensure bug is properly resolved.

Track bugs systematically for quality assurance!`;
  }

  private generateTechnicalDebtPrompt(args: Record<string, any>): string {
    const componentName = args.component_name || 'component';
    const assessmentScope = args.assessment_scope || 'system';

    return `# Technical Debt Assessment for ${componentName}

## Overview
Assess technical debt at ${assessmentScope} level.

## Assessment Categories:
- Code Quality Issues
- Architecture Problems
- Testing Gaps
- Documentation Deficits
- Performance Concerns
- Security Vulnerabilities
- Outdated Dependencies

## Assessment Process:
1. Create assessment entity
2. Identify debt items systematically
3. Prioritize based on impact
4. Create remediation tasks
5. Plan implementation timeline

## Prioritization Framework:
- High: Critical bugs, security issues
- Medium: Performance issues, maintainability
- Low: Code style, minor inefficiencies

Track technical debt to maintain code quality!`;
  }

  private generateTeamProductivityPrompt(args: Record<string, any>): string {
    const timeframe = args.timeframe || 'month';
    const focusArea = args.focus_area || 'overall';

    return `# Team Productivity Analysis for ${timeframe}

## Overview
Analyze team productivity with focus on ${focusArea}.

## Analysis Framework:

### Velocity Metrics
- Story points completed
- Tasks delivered
- Cycle time measurements

### Quality Indicators
- Bug rates detected
- Code review feedback
- Customer satisfaction

### Process Efficiency
- Meeting time vs. work time
- Context switching impact
- Tool effectiveness

## Analysis Process:
1. Gather quantitative data from project history
2. Collect qualitative feedback from team
3. Identify bottlenecks and inefficiencies
4. Develop improvement recommendations
5. Create action plan with owners and timelines

## Key Questions:
- What metrics show productivity trends?
- Which processes cause delays?
- What tools need improvement?
- How can we reduce waste?

Drive productivity improvements through data-driven insights!`;
  }

  private generateResourceAllocationPrompt(args: Record<string, any>): string {
    const resourceType = args.resource_type || 'human';
    const planningHorizon = args.planning_horizon || 'quarter';

    return `# ${resourceType} Resource Allocation for ${planningHorizon}

## Overview
Optimize ${resourceType} resource allocation planning.

## Allocation Framework:

### Current Assessment
- Available ${resourceType} resources
- Current utilization levels
- Upcoming commitments

### Demand Analysis
- Planned work requirements
- Skill set needs
- Timeline constraints

### Gap Analysis
- Resource shortages
- Overallocation risks
- Skill gaps identified

### Optimization Strategies
- Resource reallocation
- Timeline adjustments
- Additional hiring/training
- Process improvements

## Planning Process:
1. Inventory current resources
2. Project future demands
3. Identify gaps and risks
4. Develop allocation plan
5. Implement and monitor

Balance resource utilization for optimal productivity!`;
  }

  private generateStakeholderCommunicationPrompt(args: Record<string, any>): string {
    const commType = args.communication_type || 'status_update';
    const audience = args.audience || 'team';

    return `# ${commType} Communication to ${audience}

## Overview
Manage stakeholder communication effectively.

## Communication Planning:

### Message Objectives
- What information needs to be conveyed?
- What action is required from recipients?
- What concerns need to be addressed?

### Audience Analysis
- Stakeholder interests and concerns
- Preferred communication methods
- Information requirements

### Content Structure
- Context and background
- Key information and updates
- Next steps and timelines
- Contact information

### Delivery Methods
- Email for formal updates
- Meetings for complex discussions
- Chat for urgent issues
- Reports for detailed information

## Communication Process:
1. Create communication entity
2. Prepare appropriate content
3. Select delivery channel
4. Execute communication
5. Track responses and follow-up

Maintain transparent and effective stakeholder communication!`;
  }

  private generateDocumentationManagementPrompt(args: Record<string, any>): string {
    const docType = args.documentation_type || 'api';
    const updateReason = args.update_reason || 'feature addition';

    return `# ${docType} Documentation Management

## Overview
Update ${docType} documentation due to ${updateReason}.

## Documentation Types:
- API documentation
- User guides
- Technical specifications
- Release notes
- Training materials

## Update Process:
1. Assess documentation scope
2. Identify required changes
3. Update content appropriately
4. Review for accuracy and clarity
5. Publish and distribute updates
6. Plan maintenance schedule

## Quality Standards:
- Clear and concise language
- Accurate technical information
- Consistent formatting
- Comprehensive coverage
- Regular review cycles

Maintain up-to-date documentation for user success!`;
  }

  private generateChangeManagementPrompt(args: Record<string, any>): string {
    const changeDesc = args.change_description || 'Project change';
    const impactLevel = args.impact_assessment || 'Medium';

    return `# Change Management for "${changeDesc}"

## Overview
Manage ${impactLevel} impact change systematically.

## Change Management Process:

### Impact Assessment
- Scope of change
- Timeline implications
- Resource requirements
- Risk evaluation

### Stakeholder Analysis
- Affected parties
- Communication needs
- Approval requirements
- Support requirements

### Implementation Planning
- Change execution steps
- Rollback procedures
- Testing requirements
- Success criteria

### Communication Strategy
- Change announcement
- Progress updates
- Training requirements
- Support channels

## Change Process:
1. Document change request
2. Assess impact and risks
3. Develop implementation plan
4. Get necessary approvals
5. Execute change with monitoring
6. Validate success and document lessons

Manage changes systematically to minimize disruption!`;
  }

  private generateRequirementsGatheringPrompt(args: Record<string, any>): string {
    const reqType = args.requirement_type || 'functional';
    const stakeholders: string[] = args.stakeholders ? args.stakeholders.split(',').map((s: string) => s.trim()) : [];
    const stakeholdersSection = stakeholders.length > 0
      ? `\n\n## Identified Stakeholders:\n${stakeholders.map(s => `- ${s}`).join('\n')}`
      : '';

    return `# ${reqType} Requirements Gathering

## Overview
Gather comprehensive ${reqType} requirements from stakeholders.${stakeholdersSection}

## Requirements Types:
- Functional requirements
- Non-functional requirements
- Business requirements
- Technical requirements

## Gathering Methods:
- Stakeholder interviews
- Workshops and brainstorming
- Document analysis
- Prototyping and demonstrations
- Surveys and questionnaires

## Process Framework:
1. Identify key stakeholders
2. Select appropriate gathering methods
3. Prepare interview/workshop materials
4. Conduct requirements sessions
5. Document and validate requirements
6. Prioritize and finalize requirements

## Quality Assurance:
- Complete coverage of needs
- Clear and unambiguous language
- Traceability to business objectives
- Stakeholder validation
- Change management process

Gather requirements systematically for successful delivery!`;
  }

  private generateUserStoryManagementPrompt(args: Record<string, any>): string {
    const featureName = args.feature_name || 'New Feature';
    const userRole = args.user_role || 'user';

    return `# User Story Management for "${featureName}"

## Overview
Create and manage user stories for ${userRole} needs.

## User Story Format:
"As a [user role], I want [goal] so that [benefit]"

## Story Components:
- User role identification
- Desired functionality
- Business value/benefit
- Acceptance criteria
- Story points estimation

## Management Process:
1. Identify user roles and needs
2. Brainstorm potential stories
3. Write stories in standard format
4. Define acceptance criteria
5. Estimate complexity
6. Prioritize story backlog
7. Plan sprint implementation

## Quality Standards:
- Independent stories
- Negotiable requirements
- Valuable to users
- Estimable complexity
- Small and testable
- Properly prioritized

Create valuable user stories for successful delivery!`;
  }

  private generateTestingStrategyPrompt(args: Record<string, any>): string {
    const appType = args.application_type || 'web';
    const criticality = args.criticality_level || 'medium';

    return `# Testing Strategy for ${appType} Application

## Overview
Develop comprehensive testing strategy for ${criticality} criticality application.

## Testing Levels:

### Unit Testing
- Component-level testing
- Code coverage targets (80-95%)
- Automated test execution
- Mock and stub usage

### Integration Testing
- Module interaction validation
- API endpoint testing
- Database integration
- Third-party service testing

### System Testing
- End-to-end workflow validation
- Performance under load
- Security testing
- Compatibility verification

### User Acceptance Testing
- Business requirement validation
- User experience testing
- Accessibility compliance
- Cross-platform validation

## Automation Strategy:
- Unit test automation: 100%
- API test automation: 90%
- UI test automation: 50-70%
- Performance regression: Automated

## Quality Gates:
- Code coverage minimums
- Performance benchmarks
- Security scan requirements
- Manual approval processes

Implement comprehensive testing for quality assurance!`;
  }

  private generateSecurityAssessmentPrompt(args: Record<string, any>): string {
    const assessmentScope = args.assessment_scope || 'application';
    const complianceReqs = args.compliance_requirements || '';

    return `# Security Assessment for ${assessmentScope}

## Overview
Conduct comprehensive security assessment${complianceReqs ? ` with ${complianceReqs} compliance requirements` : ''}.

## Assessment Areas:

### Application Security
- Code review for vulnerabilities
- Authentication mechanism validation
- Authorization control verification
- Input validation and sanitization
- Secure coding practices

### Infrastructure Security
- Network configuration review
- Server hardening assessment
- Access control evaluation
- Encryption implementation
- Backup and recovery security

### Data Security
- Data classification and handling
- Encryption at rest and in transit
- Privacy protection measures
- Data retention policies
- Breach response procedures

### Compliance Verification
${complianceReqs ? `- ${complianceReqs} requirement validation` : '- Industry standard compliance'}
- Regulatory requirement assessment
- Audit trail verification
- Documentation review

## Assessment Process:
1. Define assessment scope and objectives
2. Select appropriate assessment methods
3. Conduct security testing and analysis
4. Document findings and vulnerabilities
5. Develop remediation recommendations
6. Create implementation roadmap

Maintain security posture through regular assessments!`;
  }

  private generatePerformanceOptimizationPrompt(args: Record<string, any>): string {
    const performanceMetric = args.performance_metric || 'response_time';
    const optimizationGoal = args.optimization_goal || 'improve by 50%';

    return `# Performance Optimization for ${performanceMetric}

## Overview
Optimize ${performanceMetric} to ${optimizationGoal}.

## Performance Analysis:

### Current State Assessment
- Baseline performance metrics
- Performance bottlenecks identification
- Resource utilization analysis
- User experience impact evaluation

### Optimization Areas
- Code efficiency improvements
- Database query optimization
- Caching strategy implementation
- Network performance enhancement
- Resource scaling optimization

### Monitoring and Measurement
- Performance metric tracking
- Automated performance testing
- Real user monitoring
- Performance regression detection

## Optimization Process:
1. Establish performance baselines
2. Identify bottlenecks and issues
3. Develop optimization strategies
4. Implement improvements iteratively
5. Validate performance gains
6. Monitor for regression

Achieve performance goals through systematic optimization!`;
  }

  private generateCICDSetupPrompt(args: Record<string, any>): string {
    const pipelineType = args.pipeline_type || 'full_ci_cd';
    const targetPlatform = args.target_platform || 'aws';

    return `# CI/CD Pipeline Setup for ${targetPlatform}

## Overview
Set up ${pipelineType} pipelines for automated deployment.

## Pipeline Stages:

### Source Control Integration
- Branch protection rules
- Code review requirements
- Automated dependency updates
- Security scanning integration

### Build Stage
- Multi-environment build configuration
- Artifact generation and storage
- Build optimization and caching
- Parallel build execution

### Test Stage
- Unit test execution and reporting
- Integration test automation
- Performance and security testing
- Test environment management

### Deploy Stage
- Environment-specific configurations
- Blue-green deployment strategies
- Rollback procedure automation
- Deployment verification and health checks

## Infrastructure Automation:
- Infrastructure as Code implementation
- Environment consistency assurance
- Resource scaling automation
- Configuration management

## Quality Assurance:
- Automated quality gates
- Security vulnerability scanning
- Performance regression testing
- Compliance verification

## Monitoring and Alerting:
- Pipeline execution monitoring
- Deployment success tracking
- Automated alerting systems
- Performance metric collection

Implement reliable automated deployment pipelines!`;
  }

  private generateArchitectureReviewPrompt(args: Record<string, any>): string {
    const architectureType = args.architecture_type || 'microservices';
    const reviewFocus = args.review_focus || 'scalability';

    return `# Architecture Review for ${architectureType}

## Overview
Conduct architecture review with focus on ${reviewFocus}.

## Review Framework:

### Scalability Assessment
- Horizontal and vertical scaling capabilities
- Load distribution effectiveness
- Performance bottleneck identification
- Resource utilization optimization

### Security Architecture Review
- Authentication and authorization patterns
- Data protection and encryption strategies
- Network security and isolation
- Security control effectiveness

### Maintainability Evaluation
- Code organization and modularity
- Documentation completeness
- Testing strategy adequacy
- Technical debt assessment

### Performance Architecture Analysis
- Response time and throughput requirements
- Caching and optimization strategies
- Database design effectiveness
- Infrastructure performance characteristics

## Review Process:
1. Define review scope and criteria
2. Assess architectural components
3. Evaluate design patterns and decisions
4. Identify improvement opportunities
5. Document findings and recommendations
6. Create implementation roadmap

Ensure architectural decisions support long-term success!`;
  }

  private generateCostManagementPrompt(args: Record<string, any>): string {
    const costCategory = args.cost_category || 'infrastructure';
    const budgetConstraint = args.budget_constraint || 'flexible';

    return `# Cost Management for ${costCategory}

## Overview
Manage ${costCategory} costs with ${budgetConstraint} budget constraints.

## Cost Analysis Framework:

### Current Cost Assessment
- Infrastructure service costs
- Personnel and contractor costs
- Tool and software license costs
- Operational and maintenance costs

### Cost Optimization Strategies
- Resource right-sizing and cleanup
- Reserved instance utilization
- Auto-scaling implementation
- Spot instance adoption where appropriate

### Budget Planning
- Cost forecasting and modeling
- Budget allocation optimization
- Cost-benefit analysis
- Scenario planning and risk assessment

### Monitoring and Control
- Real-time cost tracking
- Budget variance analysis
- Automated alerting for anomalies
- Regular cost review cycles

## Cost Management Process:
1. Establish cost baselines and budgets
2. Implement cost monitoring and tracking
3. Analyze cost drivers and patterns
4. Identify optimization opportunities
5. Implement cost reduction measures
6. Monitor and adjust cost management strategies

Optimize costs while maintaining service quality and performance!`;
  }

  private generateCustomerFeedbackPrompt(args: Record<string, any>): string {
    const feedbackChannel = args.feedback_channel || 'survey';
    const feedbackFocus = args.feedback_focus || 'usability';

    return `# Customer Feedback Management via ${feedbackChannel}

## Overview
Collect and analyze customer feedback with focus on ${feedbackFocus}.

## Feedback Collection Strategy:

### Channel Selection
- Survey platforms for structured feedback
- Support channels for issue reporting
- Review platforms for public sentiment
- Analytics platforms for behavioral insights
- Social media monitoring for brand perception

### Feedback Types
- Usability and user experience issues
- Feature requests and enhancement ideas
- Performance and reliability concerns
- Support and documentation needs
- Bug reports and functional issues

### Collection Optimization
- Clear and concise survey design
- Strategic feedback prompt placement
- Incentive programs for participation
- Multi-channel integration
- Regular feedback cycle scheduling

## Analysis Framework:

### Quantitative Analysis
- Rating and scoring analysis
- Net Promoter Score (NPS) calculation
- Statistical significance testing
- Trend analysis and forecasting

### Qualitative Analysis
- Theme and pattern identification
- Sentiment analysis
- Root cause analysis
- Priority ranking and categorization

## Action Planning:
1. Feedback triage and prioritization
2. Issue assignment and ownership
3. Implementation planning and scheduling
4. Progress tracking and communication
5. Impact measurement and validation

## Continuous Improvement:
- Feedback loop closure
- Process refinement based on insights
- Customer communication and transparency
- Feedback mechanism optimization

Drive product improvements through customer insights!`;
  }

  private generateInnovationPlanningPrompt(args: Record<string, any>): string {
    const innovationType = args.innovation_type || 'product';
    const riskTolerance = args.risk_tolerance || 'moderate';

    return `# ${innovationType} Innovation Planning

## Overview
Plan ${innovationType} innovation initiatives with ${riskTolerance} risk tolerance.

## Innovation Framework:

### Innovation Types
- Product innovation (new features, services)
- Process innovation (workflow improvements)
- Technology innovation (new tools, platforms)
- Business model innovation (revenue, market changes)

### Risk Tolerance Levels
- Conservative: Incremental improvements, proven approaches
- Moderate: Medium-risk innovations with validation paths
- Aggressive: High-risk, high-reward breakthrough innovations

### Innovation Pipeline
- Idea generation and capture
- Initial feasibility screening
- Detailed evaluation and analysis
- Prototyping and validation
- Implementation planning and scaling
- Success measurement and learning

## Planning Process:
1. Define innovation objectives and scope
2. Establish evaluation criteria and risk tolerance
3. Set up innovation pipeline and processes
4. Allocate resources and budget
5. Implement tracking and measurement
6. Review and refine innovation approach

## Success Metrics:
- Idea-to-implementation conversion rates
- Market validation and adoption metrics
- Financial return on innovation investment
- Learning and knowledge generation
- Cultural impact and innovation mindset

Foster innovation while managing risk appropriately!`;
  }

  private generateIncidentResponsePrompt(args: Record<string, any>): string {
    const incidentSeverity = args.incident_severity || 'high';
    const incidentType = args.incident_type || 'availability';

    return `# ${incidentSeverity} Severity ${incidentType} Incident Response

## Overview
Manage ${incidentSeverity} severity ${incidentType} incident systematically.

## Incident Response Framework:

### Incident Classification
- Critical: Complete system outage, data loss, security breach
- High: Major functionality impaired, significant user impact
- Medium: Minor functionality issues, limited user impact
- Low: Cosmetic issues, no functional impact

### Response Team Assembly
- Incident commander (overall responsibility)
- Technical leads (technical response)
- Communications lead (stakeholder communication)
- Subject matter experts (domain knowledge)
- Legal/compliance (if needed)

### Incident Assessment
- Scope and impact determination
- Root cause hypothesis development
- Evidence collection and preservation
- Timeline reconstruction
- Stakeholder impact evaluation

### Containment Actions
- Affected system isolation
- Temporary workaround implementation
- Damage limitation measures
- Status communication updates
- Timeline documentation

### Recovery Execution
- Recovery plan development and validation
- Step-by-step recovery execution
- System functionality verification
- Monitoring for recurrence
- Recovery effectiveness assessment

### Root Cause Analysis
- Detailed timeline analysis
- Contributing factor identification
- Root cause determination
- Lesson learned documentation
- Preventive measure identification

## Post-Incident Activities:
1. Incident documentation completion
2. Stakeholder communication and reporting
3. Process improvement identification
4. Training and awareness updates
5. Incident review and retrospective

Maintain system reliability through effective incident management!`;
  }

  private generateKnowledgeTransferPrompt(args: Record<string, any>): string {
    const knowledgeDomain = args.knowledge_domain || 'technical';
    const transferRecipients = args.transfer_recipients || 'team';

    return `# ${knowledgeDomain} Knowledge Transfer to ${transferRecipients}

## Overview
Plan and execute comprehensive knowledge transfer sessions.

## Knowledge Assessment:

### Knowledge Inventory
- Technical knowledge (architecture, code patterns, tools)
- Process knowledge (workflows, procedures, best practices)
- Business knowledge (domain expertise, business rules)
- Contextual knowledge (historical decisions, tribal knowledge)

### Recipient Analysis
- Individual team members
- Entire teams or departments
- New hires and trainees
- Cross-functional stakeholders

## Transfer Methods:

### Formal Training
- Structured workshop sessions
- Presentation-based knowledge sharing
- Hands-on training exercises
- Certification and assessment programs

### Documentation
- Comprehensive knowledge bases
- Process documentation and guides
- Video recordings and tutorials
- Interactive learning modules

### Mentoring and Shadowing
- One-on-one knowledge transfer
- Pair programming and code reviews
- Shadowing experienced team members
- Regular knowledge sharing sessions

### Self-Paced Learning
- Online learning platforms
- Recorded training sessions
- Documentation repositories
- Interactive tutorials and guides

## Transfer Planning:
1. Assess knowledge requirements and gaps
2. Select appropriate transfer methods
3. Develop detailed transfer plans
4. Schedule sessions and milestones
5. Prepare materials and resources
6. Execute transfer activities
7. Validate knowledge transfer effectiveness
8. Establish ongoing support mechanisms

## Success Measurement:
- Knowledge assessment results
- Practical application demonstrations
- Feedback from recipients
- Performance metric improvements
- Knowledge retention over time

Ensure successful knowledge transfer for team continuity!`;
  }

  private generateVendorManagementPrompt(args: Record<string, any>): string {
    const vendorType = args.vendor_type || 'cloud';
    const contractValue = args.contract_value || 'medium';

    return `# ${vendorType} Vendor Management (${contractValue} contract value)

## Overview
Manage ${vendorType} vendor relationships and performance.

## Vendor Management Framework:

### Vendor Assessment and Selection
- Technical capability evaluation
- Financial stability analysis
- Reference and case study review
- Compliance and security verification
- Cultural fit assessment

### Contract Management
- Contract term and condition review
- Service level agreement (SLA) monitoring
- Pricing and payment structure
- Termination clause understanding
- Renewal and renegotiation planning

### Performance Monitoring
- Service delivery quality tracking
- Response time and resolution metrics
- Cost variance analysis
- Innovation and value addition assessment
- Relationship health evaluation

### Risk Management
- Business continuity risk assessment
- Security and compliance risk monitoring
- Financial stability evaluation
- Performance and delivery risk tracking
- Transition and exit strategy planning

### Cost Optimization
- Contract value analysis and benchmarking
- Cost-benefit analysis of services
- Volume discount opportunity identification
- Alternative vendor evaluation
- Cost reduction negotiation

## Management Process:
1. Establish vendor relationship framework
2. Implement performance monitoring systems
3. Set up regular review and communication cycles
4. Monitor contract compliance and value delivery
5. Identify optimization and improvement opportunities
6. Maintain strategic vendor relationships

Optimize vendor relationships for maximum value delivery!`;
  }
}
