"""
ElevenLabs TTS Proxy Router
----------------------------
Proxies text-to-speech requests through the backend so the API key
is never exposed to the browser.

Endpoint:  POST /api/v1/tts/speak
Body:      { "text": "...", "lang": "hi" }
Response:  audio/mpeg stream
"""

import asyncio
from collections import OrderedDict
import logging
import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import httpx
from pydantic import BaseModel, Field

from api_server.deps import get_current_user

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["TTS"])

# ── Voice IDs ──────────────────────────────────────────────────────────────────
# Use active default voices available on ElevenLabs Free + Paid tiers with
# eleven_multilingual_v2 (legacy premade IDs like Adam/Rachel return 402 on free).
VOICE_IDS: dict[str, str] = {
    "hi": "JBFqnCBsd6RMkjVDRZzb",   # George — clear multilingual voice (Hindi & Indic)
    "en": "EXAVITQu4vr4xnSDxMaL",   # Sarah — natural English female
    "ta": "EXAVITQu4vr4xnSDxMaL",
    "te": "EXAVITQu4vr4xnSDxMaL",
    "mr": "JBFqnCBsd6RMkjVDRZzb",
    "bn": "JBFqnCBsd6RMkjVDRZzb",
    "gu": "JBFqnCBsd6RMkjVDRZzb",
    "pa": "JBFqnCBsd6RMkjVDRZzb",
    "kn": "EXAVITQu4vr4xnSDxMaL",
    "ml": "EXAVITQu4vr4xnSDxMaL",
}

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"
MODEL_ID = "eleven_multilingual_v2"
MAX_CACHE_ITEMS = 128

# Free-tier accounts allow at most 2 concurrent ElevenLabs requests.
_ELEVENLABS_SEMAPHORE = asyncio.Semaphore(2)
_AUDIO_CACHE: OrderedDict[tuple[str, str, str], bytes] = OrderedDict()


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    lang: str = Field(default="hi", max_length=5)
    stability: float = Field(default=0.5, ge=0.0, le=1.0)
    similarity_boost: float = Field(default=0.75, ge=0.0, le=1.0)


def _audio_response(audio_bytes: bytes, voice_id: str) -> StreamingResponse:
    return StreamingResponse(
        iter([audio_bytes]),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Voice-Id": voice_id,
            "X-Model": MODEL_ID,
        },
    )


@router.post(
    "/speak",
    summary="Convert text to speech via ElevenLabs",
    response_class=StreamingResponse,
)
async def speak(
    payload: TTSRequest,
    current_user: dict = Depends(get_current_user),
):
    del current_user  # authenticated dependency
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TTS service not configured (missing ELEVENLABS_API_KEY)",
        )

    clean_text = payload.text.strip()
    if not clean_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text must not be empty")

    voice_id = VOICE_IDS.get(payload.lang, VOICE_IDS["en"])
    cache_key = (payload.lang, voice_id, clean_text)

    cached = _AUDIO_CACHE.get(cache_key)
    if cached is not None:
        _AUDIO_CACHE.move_to_end(cache_key)
        return _audio_response(cached, voice_id)

    url = f"{ELEVENLABS_BASE}/text-to-speech/{voice_id}/stream"
    request_body = {
        "text": clean_text,
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": payload.stability,
            "similarity_boost": payload.similarity_boost,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }

    try:
        async with _ELEVENLABS_SEMAPHORE:
            # Re-check cache in case another in-flight request populated it
            cached = _AUDIO_CACHE.get(cache_key)
            if cached is not None:
                _AUDIO_CACHE.move_to_end(cache_key)
                return _audio_response(cached, voice_id)

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    url,
                    headers={
                        "xi-api-key": api_key,
                        "Content-Type": "application/json",
                        "Accept": "audio/mpeg",
                    },
                    json=request_body,
                )

        if response.status_code != 200:
            err_text = response.text[:300]
            logger.error("ElevenLabs error %d: %s", response.status_code, err_text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"ElevenLabs API error: {response.status_code}",
            )

        audio_bytes = response.content
        _AUDIO_CACHE[cache_key] = audio_bytes
        if len(_AUDIO_CACHE) > MAX_CACHE_ITEMS:
            _AUDIO_CACHE.popitem(last=False)

        return _audio_response(audio_bytes, voice_id)

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="ElevenLabs API timed out",
        )
    except httpx.RequestError as exc:
        logger.error("ElevenLabs request error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach ElevenLabs API",
        )


@router.get("/voices", summary="List supported voices/languages")
async def list_voices(current_user: dict = Depends(get_current_user)):
    """Return the voice mapping for the frontend."""
    del current_user
    return {
        "voices": [
            {"lang": lang, "voice_id": vid, "model": MODEL_ID}
            for lang, vid in VOICE_IDS.items()
        ]
    }
