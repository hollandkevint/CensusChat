---
  ## PROJECT CONTEXT
  Create a professional healthcare SaaS landing page for CensusChat - a natural language interface to US Census data targeting healthcare
  strategy teams. This is a B2B conversion-focused landing page that transforms expensive demographic consulting ($50K, 6 weeks) into instant
  AI-powered queries ($297/month, 23 minutes).

  **Tech Stack**: HTML5, CSS3 (or Tailwind CSS), vanilla JavaScript
  **Target Audience**: Healthcare business analysts, strategy teams, executives at health systems and Medicare Advantage plans
  **Visual Style**: Clean, professional, healthcare-industry appropriate with trustworthy medical aesthetics. Use blue (#3B82F6) as primary
  color with green accents (#10B981) for success metrics, purple (#8B5CF6) for AI/technology features.

  ## HIGH-LEVEL GOAL
  Create a mobile-first, conversion-optimized landing page that immediately communicates the value proposition: "Stop Wasting $50K on 6-Week
  Demographic Reports" and drives healthcare professionals to request early access or schedule demos.

  ## DETAILED STEP-BY-STEP INSTRUCTIONS

  ### 1. Hero Section (Above the fold)
  - Create a compelling headline: "Stop Wasting $50K on 6-Week Demographic Reports"
  - Add subtitle: "Transform 6-week $50K demographic consulting into 6-second $297/month queries"
  - Include 3 prominent CTA buttons:
    * Primary: "Get Early Access" (green background)
    * Secondary: "Schedule Demo" (blue outline)
    * Tertiary: "View Repository" (gray outline)
  - Add trust badges: "89% Test Coverage", "MCP + Claude AI", "Healthcare Demographics"
  - Mobile: Stack vertically, large headline text
  - Desktop: Center-aligned, maximum width 800px

  ### 2. Problem/Solution Comparison Section
  - Create a visual side-by-side comparison table
  - Left side: "Your Current Reality"
    * Timeline: 6-7 weeks
    * Cost: $50,000+ per analysis
    * Iterations: 1-2 (expensive to change)
    * Format: PDF reports (manual Excel entry)
  - Right side: "CensusChat Advantage"
    * Timeline: 23 minutes
    * Cost: $297/month unlimited
    * Iterations: Unlimited real-time analysis
    * Format: Excel-ready with statistical metadata
  - Include bold result callout: "$196,436 annual savings (5,500% ROI) + 300x faster insights"
  - Mobile: Stack sections vertically with clear visual separation

  ### 3. Social Proof Section
  - Feature testimonial with professional styling:
    * Quote: "Used to take our analytics team 2 weeks to pull Medicare Advantage market data. Now I get it in seconds and can focus on strategy
   instead of waiting."
    * Attribution: "Sarah L., VP Strategy, Regional Health System (2.8B revenue)"
  - Add impact metrics in a 3-column grid:
    * "6 weeks → 2 hours" decision cycle
    * "$150M facility expansion" supported
    * "Analytics team refocused" on strategy vs. data hunting

  ### 4. "How It Works" Process Section
  - Create a 3-step visual process flow:
    * Step 1: "Ask in Plain English" with example query
    * Step 2: "AI-Powered Processing" showing Claude + MCP + Census API
    * Step 3: "Professional Output" showing Excel/PDF/Tableau integration
  - Use icons and connecting arrows between steps
  - Mobile: Vertical flow, Desktop: Horizontal flow

  ### 5. Technical Credibility Section
  - Display key metrics in a 4-column grid:
    * "Sub-2 Second Queries" on 11M+ Census records
    * "89% Test Coverage" with containerized CI/CD
    * "HIPAA-Ready Architecture" with enterprise security
    * "First healthcare platform" combining MCP + Claude
  - Use subtle background highlighting and icons

  ### 6. Target Audience Section
  - Create 3 cards for primary users:
    * Business Analysts (health systems/MA plans icon)
    * Strategy Teams (expansion/facility planning icon)
    * Healthcare Researchers (population health icon)
  - List healthcare-specific features as bullet points below

  ### 7. Final CTA Section
  - Large, centered call-to-action area
  - Headline: "Ready to Transform Your Healthcare Data Strategy?"
  - Subheadline: "Stop waiting 6 weeks for $50K demographic reports. Start getting insights in 23 minutes for $297/month"
  - Same 3 CTA buttons as hero section
  - Footer tagline: "Transforming healthcare demographic analysis from weeks to seconds"

  ### 8. About Kevin Section (Bottom)
  - Brief bio section with professional headshot placeholder
  - Key points: "10+ years healthcare data experience", "2M+ member Medicare Advantage plans", "$50K consulting delays"
  - Contact links: Email, LinkedIn, GitHub

  ## CODE EXAMPLES & CONSTRAINTS

  **Color Palette**:
  - Primary Blue: #3B82F6
  - Success Green: #10B981
  - Technology Purple: #8B5CF6
  - Text: #1F2937 (dark gray)
  - Background: #FFFFFF with #F9FAFB sections

  **Typography**: Use system fonts (Inter, -apple-system, BlinkMacSystemFont)
  **Responsive Breakpoints**: Mobile (<768px), Tablet (768px-1024px), Desktop (>1024px)

  **CTA Button Examples**:
  ```html
  <a href="mailto:kevin@kevintholland.com?subject=CensusChat%20Early%20Access"
     class="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg">
     📧 Get Early Access
  </a>

  Do NOT include:
  - Complex animations or heavy JavaScript
  - External font dependencies
  - Unnecessary form fields
  - Generic stock photos

  STRICT SCOPE

  Create only:
  - Single HTML file: censuschat-landing.html
  - Embedded CSS (either inline or in  tags)
  - Minimal JavaScript for smooth scrolling and CTA interactions

  Do NOT create:
  - Separate CSS/JS files
  - Backend integration code
  - Complex form processing
  - External dependencies beyond basic HTML/CSS/JS

  Mobile-First Requirements:
  - All sections must stack vertically on mobile
  - Touch-friendly button sizes (minimum 44px height)
  - Readable font sizes (minimum 16px body text)
  - Optimized for 375px width minimum