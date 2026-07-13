from sim import SIM
from notifications import notifications

# Reset state first
SIM.overrides.clear()
SIM.assignments.clear()

# Simulate user charging at 9:30 AM (570 min), charge duration 54 min
# So charge_end = 570 + 54 = 624 min (10:24 AM)
SIM.start_charging('B06-A', 570, 54, 'you')

print("User state at t=570 (9:30 AM):", SIM.port_state('B06-A', 570))
print()

for t in [580, 590, 600, 605, 610, 615, 620, 624, 630]:
    notes = notifications(t)
    almost_done = [n for n in notes if n['id'] == 'almost-done']
    move_car = [n for n in notes if n['id'] == 'move-car']
    print(f"t={t} ({t//60}:{t%60:02d}): almost-done={len(almost_done)} move-car={len(move_car)}")
    for n in almost_done + move_car:
        print(f"  {n['id']}: {n['title']}")
    print()
