"""Small observable evaluation harness for a running MediQuery API."""

import argparse
import time

import httpx

SAMPLE_QUESTIONS = [
    "What are the common symptoms described in these documents?",
    "What risk factors are mentioned?",
    "What does the document say about treatment decisions?",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate MediQuery retrieval and citations")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--document-ids", nargs="+", type=int, required=True)
    args = parser.parse_args()

    with httpx.Client(base_url=args.base_url, timeout=90) as client:
        for question in SAMPLE_QUESTIONS:
            started = time.perf_counter()
            response = client.post(
                "/api/chat",
                json={"question": question, "document_ids": args.document_ids},
            )
            latency = time.perf_counter() - started
            response.raise_for_status()
            payload = response.json()

            print("=" * 88)
            print(f"Question: {question}")
            print(f"Latency: {latency:.2f}s")
            print(f"Answer: {payload['answer']}")
            print(f"Citations returned: {bool(payload['citations'])}")
            print("Retrieved chunks:")
            for citation in payload["citations"]:
                print(
                    f"- {citation['document_name']} p.{citation['page_number']} "
                    f"chunk={citation['chunk_index']} score={citation['score']:.3f}"
                )
                print(f"  {citation['chunk_text'][:240]}")


if __name__ == "__main__":
    main()

