# CensusChat Frontend Architecture
## Next.js 15 + React 19 + TypeScript Stack

### Overview

CensusChat's frontend is built with modern web technologies optimized for business analysts and healthcare researchers. The architecture prioritizes performance, user experience, and enterprise-grade reliability.

### Technology Stack

#### Core Framework
- **Next.js 15.4.5**: App Router, Server Components, optimized for production
- **React 19.1.0**: Latest features including concurrent rendering
- **TypeScript 5**: Full type safety throughout the application
- **Tailwind CSS 4**: Utility-first styling with dark mode support

#### Key Dependencies
```json
{
  "@tanstack/react-query": "^5.84.0",  // Server state management
  "axios": "^1.11.0",                  // HTTP client
  "clsx": "^2.1.1",                    // Conditional classes
  "lucide-react": "^0.535.0",          // Icon library
  "next-auth": "^4.24.11",             // Authentication
  "recharts": "^3.1.0",                // Data visualization
  "zustand": "^5.0.7"                  // Client state management
}
```

### Application Structure

```
frontend/src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Landing page with chat interface
│   └── globals.css        # Global styles
├── components/            # Reusable UI components
│   └── ChatInterface.tsx  # Core chat functionality
└── lib/                   # Utility functions and configurations
```

### Component Architecture

#### ChatInterface Component
**Location**: `/src/components/ChatInterface.tsx`
**Purpose**: Core user interaction component for demographic queries

**Key Features**:
- Natural language input processing
- Real-time query validation feedback
- Interactive data table rendering
- Excel/CSV export functionality
- Loading states and error handling
- Conversation history management

**State Management**:
```typescript
interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;           // Query results
  isLoading?: boolean;  // Loading state
}
```

**API Integration**:
```typescript
const handleQuery = async (query: string) => {
  const response = await fetch('/api/v1/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return await response.json();
};
```

### Landing Page Design

#### Healthcare-Focused Value Proposition
The main page (`/src/app/page.tsx`) is optimized for business analysts:

**Key Sections**:
1. **Hero Section**: "Healthcare Competitive Data in a Spreadsheet-Ready Box"
2. **Problem Identification**: Addresses delays, technical bottlenecks, consultant costs
3. **Solution Demo**: Interactive ChatInterface component
4. **Social Proof**: Healthcare system testimonials and use cases
5. **Pilot Program CTA**: Clear conversion path for enterprise users

#### Responsive Design
- Mobile-first approach with Tailwind CSS
- Dark mode support throughout
- Accessibility considerations (WCAG compliance ready)

### State Management Strategy

#### Global State (Zustand)
```typescript
interface AppState {
  user: User | null;
  queryHistory: Query[];
  preferences: UserPreferences;
  // Actions
  setUser: (user: User) => void;
  addQuery: (query: Query) => void;
  updatePreferences: (prefs: UserPreferences) => void;
}
```

#### Server State (React Query)
```typescript
// Query cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

### Data Flow Architecture

#### Query Processing Flow
1. **User Input** → ChatInterface component
2. **Frontend Validation** → Basic input sanitization
3. **API Request** → `/api/v1/queries` endpoint
4. **Backend Processing** → MCP SQL validation + Claude translation
5. **Census API Call** → External data retrieval
6. **Response Processing** → Format for display
7. **UI Update** → Show results with export options

#### Error Handling Strategy
```typescript
try {
  const result = await queryAPI(userInput);
  setMessages(prev => [...prev, successMessage(result)]);
} catch (error) {
  if (error.type === 'VALIDATION_ERROR') {
    setMessages(prev => [...prev, validationError(error.message)]);
  } else if (error.type === 'API_ERROR') {
    setMessages(prev => [...prev, apiError()]);
  } else {
    setMessages(prev => [...prev, genericError()]);
  }
}
```

### Performance Optimizations

#### Code Splitting
- Automatic route-based splitting with Next.js
- Dynamic imports for heavy components
- Lazy loading of visualization libraries

#### Image Optimization
- Next.js Image component for automatic optimization
- WebP format with fallbacks
- Responsive image sizes

#### Bundle Analysis
```bash
# Analyze bundle size
npm run build && npx @next/bundle-analyzer
```

### User Experience Features

#### Progressive Enhancement
- Works without JavaScript (basic functionality)
- Enhanced experience with JavaScript enabled
- Offline capability for cached queries

#### Loading States
- Skeleton loading for data tables
- Progressive query processing feedback
- Optimistic UI updates

#### Accessibility
- Semantic HTML structure
- ARIA labels for screen readers
- Keyboard navigation support
- High contrast mode compatibility

### API Integration

#### Backend Connection
```typescript
// Base API configuration
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});
```

#### Error Handling
```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      // Rate limiting
      throw new APIError('RATE_LIMITED', 'Too many requests');
    }
    // Handle other error types
    throw new APIError('UNKNOWN', error.message);
  }
);
```

### Data Visualization

#### Chart Integration (Recharts)
```typescript
import { BarChart, LineChart, PieChart } from 'recharts';

const renderChart = (data: any[], type: string) => {
  switch (type) {
    case 'bar':
      return <BarChart data={data} {...chartProps} />;
    case 'line':
      return <LineChart data={data} {...chartProps} />;
    case 'pie':
      return <PieChart data={data} {...chartProps} />;
  }
};
```

#### Export Functionality
```typescript
const exportToExcel = (data: any[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CensusData');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};
```

### Security Considerations

#### Input Sanitization
- XSS prevention with proper encoding
- SQL injection protection (server-side validation)
- Content Security Policy headers

#### Authentication Integration
```typescript
// NextAuth.js configuration
export const authOptions = {
  providers: [
    // OAuth providers for enterprise SSO
  ],
  callbacks: {
    jwt: ({ token, user }) => ({ ...token, ...user }),
    session: ({ session, token }) => ({ ...session, user: token }),
  },
};
```

### Development Workflow

#### Local Development
```bash
npm run dev     # Start development server
npm run build   # Production build
npm run lint    # ESLint checking
npm run typecheck # TypeScript validation
```

#### Testing Strategy
```bash
npm run test:docker  # Run tests in Docker container
npm run test:e2e     # End-to-end tests (planned)
```

### Performance Metrics

#### Core Web Vitals Targets
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms  
- **CLS (Cumulative Layout Shift)**: < 0.1

#### Bundle Size Targets
- **Initial JS Bundle**: < 200KB gzipped
- **First Paint**: < 1.5s
- **Time to Interactive**: < 3s

### Browser Support

#### Supported Browsers
- Chrome 90+ (Primary target)
- Firefox 88+
- Safari 14+
- Edge 90+

#### Progressive Enhancement
- Core functionality works in older browsers
- Enhanced features for modern browsers
- Graceful degradation for unsupported features

### Future Enhancements

#### Planned Features
- [ ] **Real-time Collaboration**: Multi-user query sessions
- [ ] **Advanced Visualizations**: Geographic mapping, statistical charts
- [ ] **Query Builder UI**: Visual interface for complex queries
- [ ] **Dashboard Creation**: Save and share query results
- [ ] **Mobile App**: React Native version for field research

#### Technical Improvements
- [ ] **Service Worker**: Offline functionality
- [ ] **PWA Features**: Install prompt, background sync
- [ ] **GraphQL Integration**: Efficient data fetching
- [ ] **Micro-frontends**: Modular architecture for scalability

### Deployment Configuration

#### Production Build
```bash
# Build for production
npm run build

# Environment variables
NEXT_PUBLIC_API_URL=https://api.censuschat.com/v1
NEXT_PUBLIC_APP_ENV=production
```

#### Docker Configuration
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

This frontend architecture provides a solid foundation for the CensusChat MVP while maintaining flexibility for future enterprise features and scaling requirements.