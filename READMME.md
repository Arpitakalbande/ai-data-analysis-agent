# 🚀 AI Data Analytics Agent

An AI-powered data analytics platform that enables users to upload CSV or Excel datasets, automatically analyze the data, generate interactive visualizations, and extract meaningful insights through an intuitive web interface.

---

## ✨ Features

- 📂 Upload CSV and Excel datasets
- 📊 Automatic Exploratory Data Analysis (EDA)
- 📈 Interactive charts and visualizations
- 🤖 AI-powered data insights and summaries
- 📉 Statistical analysis of numerical columns
- 🧹 Automatic handling of missing values
- 🔍 Correlation analysis
- 📋 Dataset overview and descriptive statistics
- 📌 Dynamic dashboard for visual analytics
- 🔐 JWT-based authentication
- ⚡ Fast and responsive UI

---

## 📸 Dashboard

The dashboard provides a centralized view of your uploaded dataset, including:

- Dataset Summary
- Key Performance Indicators (KPIs)
- Data Distribution
- Missing Value Analysis
- Correlation Heatmap
- Category-wise Analysis
- Interactive Charts
- AI Generated Insights

---

## 🛠 Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Recharts

### Backend

- FastAPI
- Python
- Pandas
- NumPy
- SQLAlchemy
- Pydantic

### AI

- Anthropic Claude API

### Database

- SQLite (Development)
- PostgreSQL/MySQL (Production Ready)

---

# 📁 Project Structure

```
AI-Data-Analysis-Agent/
│
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   ├── core/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   └── main.py
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── data-weaver-ai/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/Arpitakalbande/ai-data-analysis-agent.git
```

```
cd ai-data-analysis-agent
```

---

# Backend Setup

Navigate to backend folder

```bash
cd backend
```

Create virtual environment

```bash
python -m venv .venv
```

Activate environment

### Windows

```bash
.venv\Scripts\activate
```

### Linux / macOS

```bash
source .venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Create environment file

```
cp .env.example .env
```

Update the following variables

```
ANTHROPIC_API_KEY=your_api_key

JWT_SECRET=your_secret

JWT_ALGORITHM=HS256

JWT_EXPIRATION_HOURS=24

DATABASE_URL=sqlite:///./data.db
```

Run backend

```bash
uvicorn app.main:app --reload
```

Backend

```
http://localhost:8000
```

Swagger Documentation

```
http://localhost:8000/docs
```

---

# Frontend Setup

Navigate to frontend

```bash
cd data-weaver-ai
```

Install packages

```bash
npm install
```

Run application

```bash
npm run dev
```

Frontend

```
http://localhost:5173
```

---

# 📊 Supported File Formats

- CSV
- XLSX
- XLS

---

# 📈 Generated Analytics

The application automatically generates:

- Dataset Summary
- Shape of Dataset
- Missing Value Report
- Duplicate Analysis
- Statistical Summary
- Correlation Matrix
- Distribution Analysis
- Feature Relationships
- Interactive Charts
- AI Generated Insights

---

# 🔒 Authentication

- JWT Authentication
- Secure API Endpoints
- Protected Dashboard Routes

---

# 🌟 Future Enhancements

- PDF Report Generation
- Download Analysis Reports
- Machine Learning Predictions
- Time Series Forecasting
- Natural Language Data Queries
- Multi-user Workspace
- Cloud Storage Integration
- Advanced AI Recommendations

---

# 🤝 Contributing

Contributions are welcome.

Feel free to fork the repository and submit a pull request.

---

# 📄 License

This project is licensed under the MIT License.

---

# ⭐ Support

If you found this project useful, consider giving it a ⭐ on GitHub.
