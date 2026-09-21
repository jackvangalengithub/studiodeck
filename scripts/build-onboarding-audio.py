"""Generate caption-aligned narration and an original, quiet ambient score.

Requires Python 3, numpy, full FFmpeg and OPENAI_API_KEY (environment or .env).
Only this build step uses the speech API; playback and video rebuilds are local.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request
import wave

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public/assets/onboarding'
MASTERS = ROOT / 'scripts/assets/onboarding'
CACHE = ROOT / 'storage/onboarding-audio'
FFMPEG = os.environ.get('FFMPEG_BIN', 'ffmpeg')
RATE = 24000
MODEL = 'gpt-4o-mini-tts'
VOICE = 'marin'


def ffmpeg(*args):
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)


def api_key():
    if os.environ.get('OPENAI_API_KEY'):
        return os.environ['OPENAI_API_KEY']
    env = ROOT / '.env'
    for line in env.read_text().splitlines() if env.exists() else []:
        if line.startswith('OPENAI_API_KEY='):
            return line.split('=', 1)[1].strip().strip('\"\'')
    raise RuntimeError('Set OPENAI_API_KEY to generate narration.')


def captions(language):
    def seconds(stamp):
        h, m, s = map(float, stamp.split(':'))
        return h * 3600 + m * 60 + s
    source = (PUBLIC / ('tour-' + language + '.vtt')).read_text()
    return [(seconds(a), seconds(b), text.replace('\n', ' ')) for a, b, text in
            re.findall(r'(\d+:\d+:\d+\.\d+) --> (\d+:\d+:\d+\.\d+)\n([^\n]+(?:\n[^\n]+)*)', source)]


def speech(text, language):
    instructions = (
        'You are the welcoming narrator of a refined design studio. '
        'Use a warm, reassuring, softly smiling voice, with clear conversational delivery. '
        'Keep a consistent medium register. Speak fluidly, with brief natural pauses; '
        'no whispering, exaggerated enthusiasm, or drawn-out vowels. '
        'This is one line in a one-minute tour: aim to finish in about four seconds. '
        'Read only the supplied text. Pronounce Studiodeck as Studio Deck. '
        + ('Speak natural Netherlands Dutch.' if language == 'nl' else 'Speak natural English.')
    )
    body = json.dumps(dict(model=MODEL, voice=VOICE, input=text,
                           instructions=instructions, response_format='pcm')).encode()
    target = CACHE / (hashlib.sha256(body).hexdigest() + '.pcm')
    if not target.exists():
        request = urllib.request.Request('https://api.openai.com/v1/audio/speech', data=body,
            headers={'Authorization': 'Bearer ' + api_key(), 'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=120) as response:
            audio = response.read()
        if len(audio) < RATE or len(audio) % 2:
            raise RuntimeError('Speech API returned invalid PCM audio.')
        target.write_bytes(audio)
    samples = np.frombuffer(target.read_bytes(), dtype='<i2').astype(np.float64) / 32768
    # Remove only leading/trailing silence, keeping breaths and consonant tails.
    active = np.flatnonzero(np.abs(samples) > 0.008)
    if not len(active):
        raise RuntimeError('Speech API returned silent audio.')
    return samples[max(0, active[0] - 1200):min(len(samples), active[-1] + 2400)]


def write_wav(path, audio):
    with wave.open(str(path), 'wb') as output:
        output.setnchannels(1 if audio.ndim == 1 else audio.shape[1])
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())


def score(duration):
    """Original Cmaj9 / Am9 / Fmaj9 / Gsus2 score: soft pads and felt-like keys."""
    audio = np.zeros((round(duration * RATE), 2))
    chords = [(48, 55, 59, 62, 64), (45, 52, 55, 59, 60),
              (41, 48, 52, 55, 57), (43, 50, 55, 57, 62)]

    def note(midi, start, length, gain, pan, pad=False):
        offset = round(start * RATE)
        count = min(round(length * RATE), len(audio) - offset)
        t = np.arange(count) / RATE
        hz = 440 * 2 ** ((midi - 69) / 12)
        if pad:
            envelope = np.minimum(t / 2, 1) * np.minimum((length - t) / 2.5, 1)
            sound = (np.sin(2 * math.pi * hz * t) + .18 * np.sin(2 * math.pi * hz * 2 * t))
            sound *= 0.96 + 0.04 * np.sin(2 * math.pi * .13 * t)
        else:
            envelope = (1 - np.exp(-t * 30)) * np.exp(-t / 1.6)
            envelope *= np.minimum((length - t) / .4, 1)
            sound = (np.sin(2 * math.pi * hz * t) + .25 * np.sin(2 * math.pi * hz * 2 * t)
                     + .06 * np.sin(2 * math.pi * hz * 3 * t))
        sound *= envelope * gain
        audio[offset:offset + count, 0] += sound * math.sqrt(1 - pan)
        audio[offset:offset + count, 1] += sound * math.sqrt(pan)

    for bar, start in enumerate(np.arange(0, duration, 10)):
        chord = chords[bar % len(chords)]
        for i, pitch in enumerate(chord):
            note(pitch, start, 12, .013, .2 + .15 * i, pad=True)
        for i, tone in enumerate([2, 4, 3, 1, 4]):
            note(chord[tone] + 12, start + i * 2 + .5, 5, .020, .3 + .1 * (i % 4))
    t = np.arange(len(audio)) / RATE
    audio *= (np.minimum(t / 2, 1) * np.minimum((duration - t) / 3, 1))[:, None]
    return audio


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    MASTERS.mkdir(parents=True, exist_ok=True)
    for language in ('en', 'nl'):
        cues = captions(language)
        if len(cues) != 12 or cues[-1][1] != 60:
            raise RuntimeError('Expected twelve five-second captions for the one-minute tour.')
        narration = np.zeros(round(cues[-1][1] * RATE))
        with tempfile.TemporaryDirectory(prefix='studiodeck-audio-') as temp:
            temp = Path(temp)
            for number, (start, end, text) in enumerate(cues, 1):
                samples = speech(text, language)
                available = end - start - .35
                tempo = max(1, len(samples) / RATE / available)
                write_wav(temp / 'line.wav', samples)
                # Pitch-preserving fit; every sentence finishes before the next scene.
                ffmpeg('-i', temp / 'line.wav', '-af', f'atempo={tempo:.6f}',
                       '-f', 'f32le', '-ar', RATE, '-ac', 1, temp / 'line.raw')
                fitted = np.fromfile(temp / 'line.raw', dtype='<f4')
                if len(fitted) > round(available * RATE) + RATE * .05:
                    raise RuntimeError('Narration exceeded its caption window.')
                at = round((start + .15) * RATE)
                narration[at:at + len(fitted)] = fitted
                print(f'{language} {number:02d}/12: {len(fitted)/RATE:.2f}s (tempo {tempo:.2f})', flush=True)
            write_wav(temp / 'voice.wav', narration)
            # Consistent dialogue loudness; the quiet music sits well below speech.
            ffmpeg('-i', temp / 'voice.wav', '-af', 'loudnorm=I=-18:TP=-2:LRA=7',
                   '-f', 'f32le', '-ar', RATE, '-ac', 1, temp / 'voice.raw')
            voice = np.fromfile(temp / 'voice.raw', dtype='<f4')[:len(narration)]
            music = score(cues[-1][1])
            mixed = music.copy()
            mixed[:len(voice)] += voice[:, None]
            write_wav(temp / 'mix.wav', mixed)
            master = MASTERS / ('tour-' + language + '.flac')
            ffmpeg('-i', temp / 'mix.wav', '-c:a', 'flac', master)
            # Mux into a temp file before replacing the English source video.
            output = PUBLIC / ('tour-nl.webm' if language == 'nl' else 'tour.webm')
            ffmpeg('-i', PUBLIC / 'tour.webm', '-i', master, '-map', '0:v:0', '-map', '1:a:0',
                   '-c:v', 'copy', '-c:a', 'libopus', '-b:a', '96k', '-t', '60',
                   '-metadata:s:a:0', 'language=' + ('nld' if language == 'nl' else 'eng'),
                   temp / 'tour.webm')
            output.write_bytes((temp / 'tour.webm').read_bytes())
    print('Created English/Dutch narrated videos and reusable audio masters.')


if __name__ == '__main__':
    main()
