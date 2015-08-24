FROM python:2.7-slim

ADD ./ /usr/src/ester

CMD ["python", "/usr/src/ester/app.py"]
