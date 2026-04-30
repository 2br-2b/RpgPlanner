FROM python:3.14-slim

WORKDIR /app
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" 2>/dev/null

COPY backend.py .
COPY campaign-manager.html static/campaign-manager.html
COPY js/ static/js/

EXPOSE 8000
CMD ["uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "8000"]
