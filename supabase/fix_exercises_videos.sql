-- Evolvi Fit - vídeos para os exercícios de cardio, corrida e mobilidade
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez.

update public.exercises as e
set video_url = v.video_url
from (values
  ('Caminhada na esteira', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/treadmill-running.mp4'),
  ('Caminhada inclinada', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/treadmill-running.mp4'),
  ('Corrida na esteira', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/treadmill-running.mp4'),
  ('Corrida ao ar livre', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/running.mp4'),
  ('Corrida intervalada 1:1', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/running.mp4'),
  ('Corrida contínua 5 km', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/running.mp4'),
  ('Tiros de 400 m', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/running.mp4'),
  ('Sprint curto', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/running.mp4'),
  ('Bicicleta ergométrica', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/stationary-bike.mp4'),
  ('Elíptico', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/elliptical.mp4'),
  ('Remo ergômetro', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/cardio-exercises-machines.mp4'),
  ('Escada ergométrica', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/jump-step-up.mp4'),
  ('Pular corda', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/jump-rope.mp4'),
  ('Circuito HIIT', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/burpee.mp4'),
  ('Mobilidade de quadril', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/stretching-hip-circles-stretch.mp4'),
  ('Mobilidade de ombros', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/stretching-band-warm-up-shoulder-stretch.mp4'),
  ('Mobilidade torácica', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/stretching-kneeling-back-rotation-stretch.mp4'),
  ('Gato-camelo', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/stretching-spine-stretch.mp4'),
  ('Alongamento de posterior', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/stretching-hamstring-stretch.mp4'),
  ('Educativo de corrida - skipping', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/running.mp4'),
  ('Educativo de corrida - anfersen', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/running.mp4')
) as v(name, video_url)
where e.owner_id is null and e.name = v.name;
