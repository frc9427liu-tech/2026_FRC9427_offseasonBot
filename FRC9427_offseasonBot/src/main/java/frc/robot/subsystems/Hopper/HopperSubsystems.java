package frc.robot.subsystems.Hopper;

import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.robot.subsystems.Hopper.Conveyor.ConveyorIO;
import frc.robot.subsystems.Hopper.Conveyor.ConveyorTalon;

import static edu.wpi.first.units.Units.RotationsPerSecond;

import edu.wpi.first.units.measure.AngularVelocity;

public class HopperSubsystems extends SubsystemBase {
    public final ConveyorIO conveyor;

    public HopperSubsystems(ConveyorIO conveyorIO) {
        this.conveyor = conveyorIO;
    }

    public static HopperSubsystems create() {
        return new HopperSubsystems(new ConveyorTalon());
    }

    public Command rollrun() {
        return Commands.runEnd(
                () -> this.conveyor.setRPS(RotationsPerSecond.of(80)),
                () -> this.conveyor.stop(),
                this);
    }

    public Command setrollstop() {
        return Commands.runOnce(
                () -> this.conveyor.stop());
    }

    public void setrollshootRPS(AngularVelocity RPS) {
        this.conveyor.setRPS(RPS);
    }

    public boolean havefuel(){
       return this.conveyor.havefuel();
    }

    public Command deliver() {
        // 直接回傳指令即可，不需要用 sequence 包裝，除非未來要串接其他動作
        return this.rollrun();
    }
}