FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY scoring.py .
COPY score_routes.py .
COPY macro_reports.py .
COPY macro_routes.py .
COPY fred_macro.py .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
