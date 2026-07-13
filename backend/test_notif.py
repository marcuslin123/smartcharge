from sim import SIM
from notifications import notifications

# Simulate user charging at t=560, charge_minutes=54
SIM.start_charging('B06-A', 560, 54, 'you')

for t in [600, 605, 610, 615, 620]:
    print(f'--- t={t} ---')
    for n in notifications(t):
        print(f"  {n['id']}: {n['title']}")
    print()
