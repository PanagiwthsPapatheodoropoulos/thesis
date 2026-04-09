# Smart Resource Planner

A microservices-based resource planning application with AI-powered task allocation and prediction capabilities.

## Project Structure

The project consists of three main services:

- `frontend/`: React-based web interface built with Vite
- `backend/`: Spring Boot REST API service
- `ai_service/`: Python-based AI/ML service

## Prerequisites

- Docker and Docker Compose
- Node.js (for local frontend development)
- Java 17 (for local backend development)
- Python 3.x (for local AI service development)

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the environment variables in `.env` with your configuration

## Development

### Starting all services

```bash
docker-compose up -d
```

### Starting individual services for development

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
./mvnw spring-boot:run
```

#### AI Service
```bash
cd ai_service
pip install -r requirements.txt
python app.py
```

## API Documentation

- Backend API: http://localhost:8080/swagger-ui.html
- AI Service API: http://localhost:5000/docs

## Contributing

1. Create a feature branch
2. Commit your changes
3. Push to the branch
4. Create a Pull Request

## License

[Your chosen license]