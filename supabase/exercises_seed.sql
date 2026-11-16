-- Biblioteca de exercícios (global) com vídeos curtos e instruções.
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez (faz upsert pelo nome).
-- Vídeos: free-exercise-db-with-videos (harshvishu), hospedados em CDN público.

-- Normaliza nomes antigos (seed inicial sem acentos) para evitar duplicados.
update public.exercises set name = 'Flexão de braço'
  where owner_id is null and name = 'Flexao de braco';
update public.exercises set name = 'Tríceps testa'
  where owner_id is null and name = 'Triceps testa';

create unique index if not exists exercises_global_name_key
  on public.exercises (name) where owner_id is null;

insert into public.exercises (owner_id, name, muscle_group, equipment, video_url, instructions)
values
  (null, 'Agachamento livre', 'Pernas', 'Peso corporal', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/squat.mp4', 'Mantenha o tronco ereto, desça até as coxas ficarem paralelas ao chão e suba empurrando pelos calcanhares.'),
  (null, 'Agachamento com barra', 'Pernas', 'Barra', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/classic-barbell-squat.mp4', 'Barra apoiada nos ombros, pés na largura dos ombros, desça controlando o movimento e mantenha o core firme.'),
  (null, 'Leg press', 'Pernas', 'Máquina', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/lever-horizontal-leg-press.mp4', 'Pés na plataforma, desça até cerca de 90 graus nos joelhos sem tirar a lombar do apoio.'),
  (null, 'Cadeira extensora', 'Pernas', 'Máquina', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/lever-leg-extension.mp4', 'Estenda os joelhos de forma controlada e segure um instante no topo.'),
  (null, 'Cadeira flexora', 'Pernas', 'Máquina', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/lever-seated-leg-curl.mp4', 'Flexione os joelhos puxando o apoio e retorne devagar.'),
  (null, 'Afundo', 'Pernas', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-lunge.mp4', 'Dê um passo à frente e desça o joelho de trás próximo ao chão, mantendo o tronco ereto.'),
  (null, 'Stiff', 'Pernas', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-stiff-leg-deadlift.mp4', 'Joelhos levemente flexionados, desça os pesos rente às pernas sentindo alongar os posteriores.'),
  (null, 'Panturrilha em pé', 'Pernas', 'Máquina', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/lever-standing-calf-raise.mp4', 'Suba na ponta dos pés o máximo que conseguir e desça devagar.'),
  (null, 'Elevação pélvica', 'Glúteos', 'Peso corporal', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/female/hip-raise-bridge.mp4', 'Deitado, empurre o quadril para cima contraindo os glúteos e desça controlado.'),
  (null, 'Glúteo coice', 'Glúteos', 'Peso corporal', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/band-one-leg-kickback-bent-position.mp4', 'Em quatro apoios, eleve uma perna para trás mantendo o quadril estável.'),
  (null, 'Flexão de braço', 'Peito', 'Peso corporal', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/push-ups.mp4', 'Corpo alinhado, desça o peito até próximo do chão e suba sem deixar o quadril cair.'),
  (null, 'Supino reto', 'Peito', 'Barra', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/barbell-bench-press.mp4', 'Desça a barra até o peito e empurre para cima mantendo as escápulas retraídas.'),
  (null, 'Supino inclinado', 'Peito', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-incline-bench-press.mp4', 'No banco inclinado, desça os halteres ao lado do peito e empurre para cima.'),
  (null, 'Crucifixo', 'Peito', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-fly.mp4', 'Com cotovelos levemente flexionados, abra os braços e junte os halteres à frente do peito.'),
  (null, 'Remada curvada', 'Costas', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-bent-over-row.mp4', 'Tronco inclinado, puxe os halteres em direção ao abdômen e aperte as costas.'),
  (null, 'Puxada frontal', 'Costas', 'Máquina', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/cable-bar-lateral-pulldown-wide-shoulder-grip.mp4', 'Puxe a barra até a altura do peito levando os cotovelos para baixo.'),
  (null, 'Remada unilateral', 'Costas', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-incline-row.mp4', 'Apoiado no banco, puxe o halter em direção ao quadril mantendo o tronco firme.'),
  (null, 'Barra fixa', 'Costas', 'Barra', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/pull-up-wide-front-grip.mp4', 'Puxe o corpo até o queixo passar a barra e desça controlando.'),
  (null, 'Desenvolvimento militar', 'Ombros', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-bench-seated-press.mp4', 'Empurre os halteres acima da cabeça sem arquear a lombar e desça até a altura dos ombros.'),
  (null, 'Elevação lateral', 'Ombros', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-lateral-raise.mp4', 'Eleve os braços para os lados até a linha dos ombros, cotovelos levemente flexionados.'),
  (null, 'Elevação frontal', 'Ombros', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-front-raise.mp4', 'Eleve os halteres à frente até a altura dos ombros e desça controlando.'),
  (null, 'Rosca direta', 'Bíceps', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-biceps-curl.mp4', 'Cotovelos fixos ao lado do corpo, flexione os braços e desça devagar.'),
  (null, 'Rosca alternada', 'Bíceps', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-alternate-seated-biceps-curl.mp4', 'Alterne os braços flexionando um de cada vez, mantendo o cotovelo parado.'),
  (null, 'Tríceps testa', 'Tríceps', 'Halteres', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/dumbbell-lying-triceps-extension.mp4', 'Deitado, flexione apenas os cotovelos levando o peso à testa e estenda de volta.'),
  (null, 'Tríceps corda', 'Tríceps', 'Máquina', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/cable-pushdown-rope-attachment.mp4', 'Empurre a corda para baixo estendendo os cotovelos e abra as mãos no final.'),
  (null, 'Prancha abdominal', 'Core', 'Peso corporal', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/female/front-plank-female.mp4', 'Apoie antebraços e pontas dos pés, mantenha o corpo alinhado e o abdômen contraído.'),
  (null, 'Abdominal remador', 'Core', 'Peso corporal', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/v-up.mp4', 'Deitado, simule um movimento de remada levando joelhos e tronco ao encontro.'),
  (null, 'Abdominal supra', 'Core', 'Peso corporal', 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male/crunch-on-bench.mp4', 'Deitado, eleve o tronco tirando as escápulas do chão e desça controlando.')
on conflict (name) where owner_id is null do update set
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  video_url = excluded.video_url,
  instructions = excluded.instructions;
