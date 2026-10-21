export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "NariShield.ai Safety Platform API (Full Safety Tech Suite)",
    version: "1.2.0",
    description: "Official REST API specification for NariShield.ai. Includes Emergency SOS Dispatch, Journey Check-in Timers with server expiry workers, Incident Reporting with official PDF export, Safety Circle peer authorization, Emergency Resources directory, and AI-driven Safety Planning."
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local Development Server"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Firebase ID Token or 'demo-token' for instant local testing"
      }
    },
    schemas: {
      CheckIn: {
        type: "object",
        properties: {
          id: { type: "string", example: "checkin-1234" },
          userId: { type: "string", example: "user-demo-1" },
          durationMinutes: { type: "integer", example: 30 },
          destination: { type: "string", example: "Central Metro Station" },
          status: { type: "string", enum: ["active", "completed", "missed", "cancelled"], example: "active" },
          expiresAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      IncidentReport: {
        type: "object",
        properties: {
          id: { type: "string", example: "inc-5678" },
          userId: { type: "string", example: "user-demo-1" },
          title: { type: "string", example: "Suspicious vehicle tailgating" },
          category: { type: "string", example: "Stalking" },
          incidentDate: { type: "string", format: "date-time" },
          description: { type: "string" },
          location: { type: "string" },
          reportedToAuthorities: { type: "boolean" }
        }
      },
      SafetyCircleMember: {
        type: "object",
        properties: {
          id: { type: "string" },
          contactName: { type: "string" },
          contactEmail: { type: "string" },
          status: { type: "string", enum: ["pending", "accepted", "declined"] },
          shareLiveLocation: { type: "boolean" },
          shareJourneyStatus: { type: "boolean" },
          shareSosAlerts: { type: "boolean" }
        }
      },
      SafetyPlan: {
        type: "object",
        properties: {
          id: { type: "string" },
          journeyType: { type: "string" },
          destination: { type: "string" },
          checklist: { type: "array", items: { type: "string" } },
          recommendations: { type: "array", items: { type: "string" } }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/v1/health": {
      get: {
        summary: "Check API Health and active feature capabilities",
        security: [],
        responses: { 200: { description: "API Status" } }
      }
    },
    "/api/v1/profile": {
      get: { summary: "Get user safety profile", responses: { 200: { description: "User Profile" } } },
      put: { summary: "Update profile & preferences", responses: { 200: { description: "Profile Updated" } } }
    },
    "/api/v1/contacts": {
      get: { summary: "List emergency contacts (max 5)", responses: { 200: { description: "Contacts list" } } },
      post: { summary: "Add emergency contact", responses: { 201: { description: "Contact added" } } }
    },
    "/api/v1/contacts/{id}": {
      delete: { summary: "Delete emergency contact", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Deleted" } } }
    },
    "/api/v1/sos/trigger": {
      post: { summary: "Trigger manual or voice SOS alert", responses: { 201: { description: "SOS Dispatched" } } }
    },
    "/api/v1/sos/history": {
      get: { summary: "List SOS history", responses: { 200: { description: "Past events" } } }
    },
    "/api/v1/sos/{id}/cancel": {
      post: { summary: "Cancel active SOS alert", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Alert cancelled" } } }
    },
    "/api/v1/check-ins": {
      get: { summary: "List active and past journey check-ins", responses: { 200: { description: "Check-in list" } } },
      post: { summary: "Start a journey safety check-in timer", responses: { 201: { description: "Check-in started" } } }
    },
    "/api/v1/check-ins/{id}/confirm": {
      post: { summary: "Confirm safety (I'm Safe action)", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Marked safe" } } }
    },
    "/api/v1/check-ins/{id}/extend": {
      post: { summary: "Extend active countdown timer", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Timer extended" } } }
    },
    "/api/v1/check-ins/{id}/cancel": {
      post: { summary: "Cancel check-in journey", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Cancelled" } } }
    },
    "/api/v1/incidents": {
      get: { summary: "Retrieve user incident reports", responses: { 200: { description: "Incident list" } } },
      post: { summary: "Create new incident report", responses: { 201: { description: "Incident created" } } }
    },
    "/api/v1/incidents/{id}": {
      delete: { summary: "Delete incident report", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Deleted" } } }
    },
    "/api/v1/incidents/{id}/pdf": {
      get: { summary: "Download official Incident Statement in PDF format", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Binary PDF Stream" } } }
    },
    "/api/v1/safety-circle": {
      get: { summary: "List safety circle members", responses: { 200: { description: "Circle members" } } }
    },
    "/api/v1/safety-circle/invite": {
      post: { summary: "Send safety circle guardian invitation", responses: { 201: { description: "Invitation sent" } } }
    },
    "/api/v1/safety-circle/{id}": {
      delete: { summary: "Revoke guardian access", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Access revoked" } } }
    },
    "/api/v1/safety-circle/{id}/permissions": {
      put: { summary: "Update guardian granular permissions", parameters: [{ name: "id", in: "path", required: true }], responses: { 200: { description: "Permissions updated" } } }
    },
    "/api/v1/resources/nearby": {
      get: {
        summary: "Search verified nearby police, hospital, and helpline directory",
        security: [],
        responses: { 200: { description: "Directory results" } }
      }
    },
    "/api/v1/safety-plans": {
      get: { summary: "List saved safety plans", responses: { 200: { description: "Plans list" } } }
    },
    "/api/v1/safety-plans/generate": {
      post: { summary: "Generate predictive commute checklist & safety plan", responses: { 201: { description: "Plan generated" } } }
    }
  }
};
