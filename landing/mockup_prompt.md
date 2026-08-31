---
  ## PROJECT CONTEXT
  Create a professional healthcare SaaS landing page for CensusChat - a natural language interface to US Census data targeting healthcare
  strategy teams. This is a B2B conversion-focused landing page that replaces expensive demographic consulting (an estimated $50K and 6 weeks)
  with natural-language queries over US Census data. CensusChat has no subscription to sell: the two offers are a fixed-price delivered analysis,
  scoped and quoted before work starts, and free early access to the self-serve product while it is built.

  **Tech Stack**: HTML5, CSS3 (or Tailwind CSS), vanilla JavaScript
  **Target Audience**: Healthcare business analysts, strategy teams, executives at health systems and Medicare Advantage plans
  **Visual Style**: Clean, professional, healthcare-industry appropriate with trustworthy medical aesthetics. Use blue (#3B82F6) as primary
  color with green accents (#10B981) for success metrics, purple (#8B5CF6) for AI/technology features.

  ## HIGH-LEVEL GOAL
  Create a mobile-first, conversion-optimized landing page that immediately communicates the value proposition: "Stop Waiting Weeks for a
  Demographic Report" and drives healthcare professionals to request early access or schedule demos.

  ## DETAILED STEP-BY-STEP INSTRUCTIONS

  ### 1. Hero Section (Above the fold)
  - Create a compelling headline: "Stop Waiting Weeks for a Demographic Report"
  - Add subtitle: "Ask 3,144 counties and 239,741 block groups a question in plain English. Get an Excel-ready answer back."
  - Include 3 prominent CTA buttons:
    * Primary: "Get Free Early Access" (green background)
    * Secondary: "Schedule Demo" (blue outline)
    * Tertiary: "View Repository" (gray outline)
  - Add trust badges: "84 ACS Variables", "MCP + Claude AI", "Excel & PDF Export"
  - Mobile: Stack vertically, large headline text
  - Desktop: Center-aligned, maximum width 800px

  ### 2. Problem/Solution Comparison Section
  - Create a visual side-by-side comparison table
  - Left side: "Your Current Reality"
    * Timeline: 6-7 weeks
    * Cost: an estimated $50,000+ per analysis
    * Iterations: 1-2 (expensive to change)
    * Format: PDF reports (manual Excel entry)
  - Right side: "CensusChat Advantage"
    * Coverage: 3,144 counties and 239,741 block groups, 84 ACS variables each
    * Cost: fixed price per analysis, quoted before work starts
    * Iterations: refine and re-run within the same engagement
    * Format: Excel-ready with statistical metadata
  - Mobile: Stack sections vertically with clear visual separation

  ### 3. "How It Works" Process Section
  - Create a 3-step visual process flow:
    * Step 1: "Ask in Plain English" with example query
    * Step 2: "AI-Powered Processing" showing Claude + MCP + DuckDB
    * Step 3: "Professional Output" showing Excel/CSV/PDF export
  - Use icons and connecting arrows between steps
  - Mobile: Vertical flow, Desktop: Horizontal flow

  ### 4. Technical Credibility Section
  - Display key capabilities in a 4-column grid:
    * "Sub-2 Second Query Target" with a 30-second enforced request timeout
    * "SQL Injection Protection" via table/column allowlists and row limits
    * "Privacy-First Architecture" - no PHI stored, audit logging, encryption at rest
    * "MCP + Claude Sonnet 4" for natural-language-to-SQL translation
  - Use subtle background highlighting and icons

  ### 5. Target Audience Section
  - Create 3 cards for primary users:
    * Business Analysts (health systems/MA plans icon)
    * Strategy Teams (expansion/facility planning icon)
    * Healthcare Researchers (population health icon)
  - List healthcare-specific features as bullet points below

  ### 6. Final CTA Section
  - Large, centered call-to-action area
  - Headline: "Ready to Transform Your Healthcare Data Strategy?"
  - Subheadline: "Stop waiting weeks for a demographic report. Ask for a fixed-price analysis, or get free early access to the tool."
  - Same 3 CTA buttons as hero section
  - Footer tagline: "US Census demographics, queried in plain English"

  ### 7. About Kevin Section (Bottom)
  - Brief bio section with professional headshot placeholder
  - Key points: "10+ years healthcare data experience"
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