# Kinda Content Layer

**A human-curated dataset for a safer digital childhood.**

## 📖 Overview

This repository serves as the **content layer (database)** for the **Kinda** project. 

Kinda is a digital initiative designed to establish a safe and enriching environment for children's multimedia consumption. Recognizing the reality of the "iPad Kid"—where screen time is often inevitable—this project aims to transform that time into a positive, educational, and safe experience through rigorous human curation rather than algorithmic recommendation.

## 🎯 Mission

The core goal of this dataset is to mitigate the risks associated with unsupervised navigation and algorithmic exposure on major video platforms. We provide a structured source of truth for:

- **Beneficial Animated Series:** Content promoting values, early education, and critical thinking.
- **DIY & Craft Videos:** Encouraging creativity and real-world interaction.
- **Curated Reading & Games:** Safe, ad-free educational resources.

## 📂 Repository Structure

This repository is designed to be **frontend-agnostic**. It houses the raw data and metadata consumed by the Kinda user interface (and potentially other clients).

```text
/kinda-db
├── context/       # Project manifestos, design docs, and detailed specifications.
└── series/        # JSON datasets containing metadata for animated series.
```

## 🔌 Integration

This dataset is intended to be consumed/fetched by the client-side application or build process of the frontend. By keeping the data decoupled from the UI implementation:

1.  **Technology Independence:** The frontend framework can evolve or change completely without restructuring the core data.
2.  **Open Contribution:** The community can suggest content updates (via Pull Requests to the JSON files) without needing to understand the complexity of the application code.

## 📄 License & Content

The **curated dataset and metadata** in this repository are licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** license. This is a non-profit initiative; you are free to use and adapt this data for non-commercial purposes, provided you give appropriate credit.

*Note: The actual video content referencing external platforms (e.g., YouTube embeds) remains the intellectual property of their respective creators and rights holders. Kinda only organizes access to this publicly available content.*
