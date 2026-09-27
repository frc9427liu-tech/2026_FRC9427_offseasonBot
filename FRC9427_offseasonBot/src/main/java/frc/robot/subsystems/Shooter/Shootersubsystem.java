package frc.robot.subsystems.Shooter;

import static edu.wpi.first.units.Units.Degree;
import static edu.wpi.first.units.Units.RotationsPerSecond;

import org.littletonrobotics.junction.Logger;

import edu.wpi.first.units.measure.Angle;
import edu.wpi.first.units.measure.AngularVelocity;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.robot.subsystems.Shooter.Flywheel.FlywheelIO;
import frc.robot.subsystems.Shooter.Flywheel.FlywheelTalon;
import frc.robot.subsystems.Shooter.Hood.HoodHardware;
import frc.robot.subsystems.Shooter.Hood.HoodIO;
import frc.robot.subsystems.Shooter.Tigger.TiggerTalon;
import frc.robot.subsystems.Shooter.Tigger.TriggerIO;

public class Shootersubsystem extends SubsystemBase {

    private final HoodIO hood;
    private final FlywheelIO flywheel;
    private final TriggerIO trigger;

    public Shootersubsystem(TriggerIO trigger, HoodIO hood, FlywheelIO flywheel) {
        this.hood = hood;
        this.flywheel = flywheel;
        this.trigger = trigger;
    }

    public static Shootersubsystem create() {
        return new Shootersubsystem(
                new TiggerTalon(),
                new HoodHardware(),
                new FlywheelTalon());
    }

    public Command shoot() {
        return Commands.sequence(
                // 1. 同時啟動飛輪與調整角度
                Commands.parallel(
                        Commands.runOnce(() -> this.flywheel.setRPS(RotationsPerSecond.of(60.0))),
                        Commands.runOnce(() -> this.hood.setAngle(Degree.of(55.0)))),
                // 2. 卡在這裡等待，直到飛輪到達目標轉速
                Commands.waitUntil(this::isAtSetPosition),
                // 3. 轉速到了，啟動板機送球
                Commands.runOnce(() -> this.trigger.setRPS(RotationsPerSecond.of(40.0))));
    }

    public Command stop() {
        return Commands.parallel(
                Commands.runOnce(() -> this.flywheel.stop()),
                Commands.runOnce(() -> this.trigger.stop()),
                Commands.runOnce(() -> this.hood.setAngle(Degree.of(1))));
    }
    public void flywheelsetRPS(AngularVelocity RPS){
        this.flywheel.setRPS(RPS);
    }
    public void hoodsetAngle(Angle angle){
        this.hood.setAngle(angle);
    }
    public void tiggerrun(){
        this.trigger.setRPS(RotationsPerSecond.of(45.0));
    }

    public boolean isAtSetPosition() {
        return flywheel.isAtSetPosition() && hood.isAtSetPosition();
    }
    public Command sisid(){
       return this.hood.sysIdTest();
    }

    @Override
    public void periodic() {
        Logger.recordOutput("hoodangle", this.hood.getAngle());
        Logger.recordOutput("hoodisatposition", this.hood.isAtSetPosition());
        Logger.recordOutput("shootrps", this.flywheel.getRPS());
        Logger.recordOutput("flywheelisatposition", this.flywheel.isAtSetPosition());
        Logger.recordOutput("isAtSetPosition", isAtSetPosition());
    }
}
