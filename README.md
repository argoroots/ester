Very simple web service to get JSON fromated results from ester.ee database.

It's been used to proxy ester.ee requests for Entu.ee.

Runs on Python 3.14 as an AWS Lambda handler (`search.handler`).
Queries ester.ee over Z39.50 (`ester.ester.ee:212`).

Vendored dependencies:
- [PyZ3950](https://github.com/asl2/PyZ3950) (master, with a small `ccl.py`
  regex patch for Python 3.11+: inline `(?i)` flags changed to scoped `(?i:...)`)
- [ply](https://pypi.org/project/ply/) 3.11
- [pymarc](https://pypi.org/project/pymarc/) 5.4.0 (used for MARC parsing
  instead of PyZ3950's own zmarc renderer, which fails on ESTER's UTF-8 records)

Deploy to AWS Lambda (runtime: Python 3.14, handler: `search.handler`).
Build the deployment package with:

    zip -r function.zip search.py PyZ3950 ply pymarc -x '*__pycache__*'
