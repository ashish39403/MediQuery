import re
from dataclasses import dataclass

BASE_NOTICE = "This answer is based only on uploaded documents and is not medical advice."
HIGH_RISK_NOTICE = (
    "This question may involve diagnosis, dosage, emergency symptoms, or treatment decisions. "
    "Consult a licensed medical professional. If symptoms may be life-threatening, contact local "
    "emergency services immediately."
)

HIGH_RISK_TERMS = (
    "dosage",
    "dose",
    "tablet",
    "medicine",
    "emergency",
    "chest pain",
    "difficulty breathing",
    "diagnosis",
    "diagnose",
    "treatment",
    "prescription",
    "pregnant",
    "child",
    "severe pain",
)


@dataclass(frozen=True)
class SafetyAssessment:
    high_risk: bool
    matched_terms: tuple[str, ...]
    notice: str


def assess_medical_risk(question: str) -> SafetyAssessment:
    normalized = question.casefold()
    matched = tuple(
        term for term in HIGH_RISK_TERMS if re.search(rf"\b{re.escape(term)}\b", normalized)
    )
    notice = f"{HIGH_RISK_NOTICE} {BASE_NOTICE}" if matched else BASE_NOTICE
    return SafetyAssessment(bool(matched), matched, notice)

