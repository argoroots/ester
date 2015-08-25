FROM python:2.7-slim

ADD ./ /usr/src/entu-ester

CMD ["python", "/usr/src/entu-ester/app.py"]
