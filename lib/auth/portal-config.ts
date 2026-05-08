export type PortalRole =
  | "clients"
  | "admin"
  | "managers"
  | "participants"
  | "super";

export interface PortalConfig {
  role: PortalRole;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  helper: string;
}

export const portalConfigs: Record<PortalRole, PortalConfig> = {
  super: {
    role: "super",
    label: "Super Admin",
    eyebrow: "Super admin access",
    title: "Super Admin Control Center",
    description:
      "Use your approved Google account to enter the Deaimer super admin workspace for platform oversight, role governance, and operational control.",
    helper:
      "Sign in with your Google account to continue to the Deaimer super admin workspace.",
  },
  clients: {
    role: "clients",
    label: "Clients",
    eyebrow: "Client access",
    title: "Client Sign Up",
    description:
      "Use your Google account to create your client access profile for Deaimer projects, communication, and delivery updates.",
    helper:
      "Only Google sign up is enabled on this page. After sign-in, we will prefill your profile from Google and let you edit anything before saving.",
  },
  admin: {
    role: "admin",
    label: "Admin",
    eyebrow: "Admin access",
    title: "Admin Sign Up",
    description:
      "Create an admin access profile with Google so your operations, oversight, and reporting workspace starts with verified account details.",
    helper:
      "Sign in with Google to continue to your admin workspace.",
  },
  managers: {
    role: "managers",
    label: "Managers",
    eyebrow: "Manager access",
    title: "Manager Sign Up",
    description:
      "Sign up with Google to create your manager profile for team coordination, QA workflows, and task oversight inside Deaimer.",
    helper:
      "Only Google sign up is enabled on this page. We pull your Google details in first and you can adjust them before saving.",
  },
  participants: {
    role: "participants",
    label: "Participants",
    eyebrow: "Participant access",
    title: "Participant Sign Up",
    description:
      "Join Deaimer as a participant using Google sign up, then finish your profile so project teams know how to reach and place you.",
    helper:
      "Only Google sign up is enabled on this page. Google details will prefill the profile form, and you can still edit them before continuing.",
  },
};
