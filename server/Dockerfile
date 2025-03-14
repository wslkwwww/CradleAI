FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# Set default environment variables
ENV SECRET_KEY="change_this_in_production"
ENV DB_HOST="db"
ENV DB_USER="root"
ENV DB_PASSWORD="password"
ENV DB_NAME="openrouter_proxy"
ENV APP_HOSTNAME="https://myapp.com"
ENV APP_TITLE="MyApp"

EXPOSE 5000

CMD ["python", "app.py"]
