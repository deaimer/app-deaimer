export interface ServicePage {
  index: string;
  slug: string;
  title: string;
  eyebrow: string;
  metric: string;
  focus: string;
  description: string;
  menuDescription: string;
  menuItems: string[];
  features: string[];
  tags: string[];
}

export const servicePages: ServicePage[] = [
  {
    index: "01",
    slug: "data-collection-sourcing",
    title: "Data Collection & Sourcing",
    eyebrow: "Text | Audio | Image | Video | Recruitment",
    metric: "Global reach",
    focus: "High-volume acquisition across global regions.",
    description:
      "We run high-volume data collection programs across global regions, combining targeted participant sourcing with structured production oversight for text, audio, image, and video datasets.",
    menuDescription:
      "High-volume acquisition across global regions with targeted participant recruitment and dependable production oversight.",
    menuItems: [
      "Text & dialogue datasets",
      "Audio & speech capture",
      "Image & video collection",
      "Participant sourcing",
    ],
    features: [
      "Text & Dialogue: Scripted and natural language datasets",
      "Audio & Speech: Multi-dialect voice recordings and acoustic data",
      "Image & Video: Face collection, object detection, and motion data",
      "Participant Sourcing: Targeted recruitment based on specific demographic criteria",
      "Regional coordination for scalable, repeatable field operations",
      "Delivery tracking and completion reporting throughout production",
    ],
    tags: ["Text", "Speech", "Image", "Video", "Sourcing"],
  },
  {
    index: "02",
    slug: "annotation-gen-ai",
    title: "Annotation & Gen AI Services",
    eyebrow: "Labeling | RLHF | Prompts | SFT",
    metric: "Model training",
    focus: "Enhancing raw data for model training.",
    description:
      "We enhance raw data for model training with human-led labeling, alignment workflows, prompt design, and supervised fine-tuning support across modern AI programs.",
    menuDescription:
      "Human-led enrichment for model training, alignment, prompting, and fine-tuning workflows.",
    menuItems: [
      "Multi-modal labeling",
      "RLHF services",
      "Prompt engineering & eval",
      "Supervised fine-tuning",
    ],
    features: [
      "Multi-Modal Labeling: Semantic segmentation, bounding boxes, and text tagging",
      "RLHF Services: Reinforcement Learning from Human Feedback for LLM alignment",
      "Prompt Engineering & Eval: Creating and testing high-quality prompts for generative models",
      "Supervised Fine-Tuning (SFT): High-quality human-annotated data for model refinement",
      "Reviewer oversight and rework loops for consistency",
      "Structured outputs designed for downstream training pipelines",
    ],
    tags: ["Labeling", "RLHF", "Prompts", "SFT", "Alignment"],
  },
  {
    index: "03",
    slug: "evaluation-transcription",
    title: "Evaluation & Transcription",
    eyebrow: "QA | Validation | Relevance | Conversion",
    metric: "QA and accuracy",
    focus: "Accuracy, quality assurance, and conversion.",
    description:
      "This service line focuses on accuracy, quality assurance, and structured conversion, helping clients validate outputs before data reaches production environments.",
    menuDescription:
      "Accuracy, QA, validation, and structured conversion before delivery to the client.",
    menuItems: [
      "Multi-media transcription",
      "Model benchmarking",
      "Search relevance",
      "Audio/speech evaluation",
    ],
    features: [
      "Multi-Media Transcription: Converting audio, image, and video content into structured text",
      "Model Benchmarking: Measuring model behavior, relevance, and training data validation",
      "Search Relevance: Optimizing search algorithms through human ranking and feedback",
      "Audio/Speech Evaluation: Specialized linguistic and quality assessment",
      "QA review checkpoints designed to improve consistency",
      "Program-level reporting tied to measurable quality outcomes",
    ],
    tags: ["Transcription", "Benchmarking", "Search", "Validation", "QA"],
  },
  {
    index: "04",
    slug: "global-managed-workforce",
    title: "Global Managed Workforce",
    eyebrow: "Talent | Vetting | Placement | Compliance",
    metric: "Vetted teams",
    focus: "The Deaimer Global Workforce and expert talent.",
    description:
      "The Deaimer Global Workforce gives clients access to vetted talent, managed teams, and role-based placement built for long-running AI delivery programs.",
    menuDescription:
      "The Deaimer global workforce with expert talent, managed teams, and strict compliance standards.",
    menuItems: [
      "Expert sourcing & vetting",
      "Managed operational teams",
      "Role-based placement",
      "Compliance & ethics",
    ],
    features: [
      "Expert Sourcing & Vetting: Finding and testing specialized talent for niche AI programs",
      "Managed Operational Teams: Long-running, dedicated teams for consistent project delivery",
      "Role-Based Placement: Efficient assignment of Participants, Managers, and QA leads",
      "Compliance & Ethics: Ensuring all talent meets strict privacy and IP standards",
      "Scalable workforce coordination across regions and roles",
      "Operational continuity for repeat work and expanding programs",
    ],
    tags: ["Workforce", "Vetting", "Placement", "Compliance", "Ops"],
  },
  {
    index: "05",
    slug: "custom-software-development",
    title: "Custom Software Development",
    eyebrow: "Portals | Automation | Pipelines | Reporting",
    metric: "Proprietary systems",
    focus: "The technology that powers the agency.",
    description:
      "This is the technology layer behind Deaimer delivery: proprietary tools, secure workflows, and reporting systems that help clients manage projects with more control.",
    menuDescription:
      "The proprietary technology that powers secure project delivery, reporting, and platform operations.",
    menuItems: [
      "Proprietary portals",
      "Workflow automation",
      "Data pipeline development",
      "Analytics & reporting",
    ],
    features: [
      "Proprietary Portals: Custom-built dashboards for Clients, Managers, and Participants",
      "Workflow Automation: Tools that speed up delivery and reporting",
      "Data Pipeline Development: Secure pipelines for handling large-scale data transfer",
      "Analytics & Reporting: Real-time tracking of project progress and quality metrics",
      "Operational tooling designed for secure project oversight",
      "Scalable platform foundations for future client programs",
    ],
    tags: ["Portals", "Automation", "Pipelines", "Reporting", "Infrastructure"],
  },
];
