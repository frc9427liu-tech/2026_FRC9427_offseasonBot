package frc.robot.subsystems.Intake;

import static edu.wpi.first.units.Units.Degrees;
import static edu.wpi.first.units.Units.Radians;
import static edu.wpi.first.units.Units.RotationsPerSecond;
import static edu.wpi.first.units.Units.Volts;

import org.littletonrobotics.junction.Logger;

import edu.wpi.first.units.measure.Angle;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.robot.subsystems.Intake.Arm.ArmHardware;
import frc.robot.subsystems.Intake.Arm.ArmIO;
import frc.robot.subsystems.Intake.Roller.RollerIO;
import frc.robot.subsystems.Intake.Roller.RollerIOHardware;

public class IntakeSubsystem extends SubsystemBase {

    private final ArmIO arm;
    private final RollerIO roller;

    private intakestate state = intakestate.none;

    public IntakeSubsystem(ArmIO arm, RollerIO roller) {
        this.arm = arm;
        this.roller = roller;
    }

    public static IntakeSubsystem create() {
        return new IntakeSubsystem(
                new ArmHardware(),
                new RollerIOHardware());
    }

    public enum intakestate {
        suck, none;
    }

    public void intakedown() {
        this.arm.setPosition(0.25);
    }

    public void intakeup() {
        this.arm.setPosition(0.0);
    }

    public Command intakedownCommand() {
        return this.runOnce(() -> this.intakedown());
    }

    public Command intakeupCommand() {
        return this.runOnce(() -> this.intakeup());
    }

    public Command intakerollrun() {
        return Commands.runEnd(
                () -> this.roller.setRPS(RotationsPerSecond.of(40.0)),
                () -> this.roller.stop(),
                this);
    }

    public Command intakerun() {
        return Commands.sequence(this.intakedownCommand(), this.intakerollrun());
    }

    public boolean havefuel() {
        return this.arm.havefuel();
    }

    public Command stopintake() {
        return Commands.parallel(Commands.runOnce(() -> this.roller.stop()));
    }

    public Command intakeUpAndShootCommand() {
        return Commands.parallel(
                Commands.runOnce(() -> this.arm.setPosition(0.0)),
                // 由於在同一個子系統內，這樣寫可以避免外部亂呼叫造成的衝突
                Commands.runOnce(() -> this.roller.setRPS(RotationsPerSecond.of(10.0))));
    }

    public Command intakedownandstop() {
        return Commands.parallel(
                this.intakedownCommand(),
                // 由於在同一個子系統內，這樣寫可以避免外部亂呼叫造成的衝突
                Commands.runOnce(() -> this.roller.stop()));
    }

    @Override
    public void periodic() {
        Logger.recordOutput("intakearmangle", this.arm.getPosition());
    }
}