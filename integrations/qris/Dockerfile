FROM python:3.13-slim@sha256:2d44738ebf4ce5f63b9d9ea871e9c7cfdc0426f7b0c97cac915fd88ded1d86bb
WORKDIR /opt/qris
ENV PYTHONPATH=/opt/qris/vendor PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd -u 10001 -m qris && mkdir /data && chown qris:qris /data
COPY --chown=qris:qris vendor ./vendor
COPY --chown=qris:qris worker.py health_http.py test_worker.py vendor-manifest.json ./
USER qris
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s CMD python -c "import pathlib,time; assert time.time()-int(pathlib.Path('/tmp/qris-health').read_text())<120"
CMD ["python","worker.py"]
