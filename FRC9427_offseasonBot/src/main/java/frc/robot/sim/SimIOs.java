package frc.robot.sim;

import static edu.wpi.first.units.Units.Degrees;
import static edu.wpi.first.units.Units.RotationsPerSecond;

import edu.wpi.first.units.measure.Angle;
import edu.wpi.first.units.measure.AngularVelocity;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import frc.robot.subsystems.Hopper.Conveyor.ConveyorIO;
import frc.robot.subsystems.Intake.Arm.ArmIO;
import frc.robot.subsystems.Intake.Roller.RollerIO;
import frc.robot.subsystems.Shooter.Flywheel.FlywheelIO;
import frc.robot.subsystems.Shooter.Hood.HoodIO;
import frc.robot.subsystems.Shooter.Tigger.TriggerIO;

/** Simulation versions of the mechanism IO interfaces (no CAN hardware needed). */
public final class SimIOs {
    private SimIOs() {}

    /** Value that approaches a target at a limited rate; updated lazily from the FPGA clock. */
    static class Slew {
        private double value;
        private double target;
        private final double ratePerSec;
        private double last = Timer.getFPGATimestamp();

        Slew(double initial, double ratePerSec) {
            this.value = initial;
            this.target = initial;
            this.ratePerSec = ratePerSec;
        }

        void set(double t) {
            update();
            target = t;
        }

        double get() {
            update();
            return value;
        }

        double target() {
            return target;
        }

        private void update() {
            double now = Timer.getFPGATimestamp();
            double step = ratePerSec * (now - last);
            last = now;
            value += Math.max(-step, Math.min(step, target - value));
        }
    }

    /** Velocity mechanism (flywheel/trigger/conveyor/roller). Spins up at accelRps2 (RPS per second). */
    static class VelocitySim {
        private final Slew s;
        private final double tolerance;

        VelocitySim(double accelRps2, double tolerance) {
            this.s = new Slew(0, accelRps2);
            this.tolerance = tolerance;
        }

        void setRPS(AngularVelocity v) {
            s.set(v.in(RotationsPerSecond));
        }

        AngularVelocity getRPS() {
            return RotationsPerSecond.of(s.get());
        }

        void stop() {
            s.set(0);
        }

        boolean atSet() {
            double target = s.target();
            double cur = s.get();
            if (Math.abs(target) < 0.1) {
                return Math.abs(cur) < 1.0;
            }
            return Math.abs(target - cur) <= tolerance;
        }
    }

    public static class FlywheelSim implements FlywheelIO {
        private final VelocitySim m = new VelocitySim(100.0, 3.0);

        @Override public void setRPS(AngularVelocity RPS) { m.setRPS(RPS); }
        @Override public AngularVelocity getRPS() { return m.getRPS(); }
        @Override public boolean isAtSetPosition() { return m.atSet(); }
        @Override public void stop() { m.stop(); }
        @Override public boolean havefuel() { return false; }
    }

    public static class TriggerSim implements TriggerIO {
        private final VelocitySim m = new VelocitySim(200.0, 3.0);

        @Override public void setRPS(AngularVelocity RPS) { m.setRPS(RPS); }
        @Override public AngularVelocity getRPS() { return m.getRPS(); }
        @Override public boolean isAtSetPosition() { return m.atSet(); }
        @Override public void stop() { m.stop(); }
        @Override public boolean havefuel() { return false; }
    }

    public static class ConveyorSim implements ConveyorIO {
        private final VelocitySim m = new VelocitySim(200.0, 3.0);

        @Override public void setRPS(AngularVelocity rps) { m.setRPS(rps); }
        @Override public AngularVelocity getRPS() { return m.getRPS(); }
        @Override public void stop() { m.stop(); }
        @Override public boolean isAtSetPosition() { return m.atSet(); }
        @Override public boolean havefuel() { return false; }
    }

    public static class RollerSim implements RollerIO {
        private final VelocitySim m = new VelocitySim(200.0, 3.0);

        @Override public void setRPS(AngularVelocity RPS) { m.setRPS(RPS); }
        @Override public AngularVelocity getRPS() { return m.getRPS(); }
        @Override public boolean isAtSetPosition() { return m.atSet(); }
        @Override public void stop() { m.stop(); }
    }

    /** Hood angle in degrees; matches HoodHardware's 1 degree start and 2 degree tolerance. */
    public static class HoodSim implements HoodIO {
        private final Slew s = new Slew(1.0, 1080.0);

        @Override public void setAngle(Angle angle) { s.set(angle.in(Degrees)); }
        @Override public double getAngle() { return s.get(); }
        @Override public void configure() {}
        @Override public boolean isAtSetPosition() { return Math.abs(s.target() - s.get()) < 2.0; }
        @Override public Command sysIdTest() { return Commands.none(); }
    }

    /** Intake arm position in rotations (0 = up, 0.25 = down). */
    public static class ArmSim implements ArmIO {
        private final Slew s = new Slew(0.0, 0.5);

        @Override public void setPosition(double m) { s.set(m); }
        @Override public double getPosition() { return s.get(); }
        @Override public void resetEncoder() { s.set(0.0); }
        @Override public void configure() {}
        @Override public Command sysid() { return Commands.none(); }
        @Override public boolean havefuel() { return false; }
    }
}
