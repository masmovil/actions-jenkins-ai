FROM python/3.11-slim

COPY requirements.txt /requirements.txt
COPY main.py /main.py
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]