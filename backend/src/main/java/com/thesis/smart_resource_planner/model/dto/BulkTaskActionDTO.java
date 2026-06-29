// src/main/java/com/thesis/smart_resource_planner/model/dto/BulkTaskActionDTO.java
package com.thesis.smart_resource_planner.model.dto;

import com.thesis.smart_resource_planner.enums.TaskStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkTaskActionDTO {
    private List<UUID> taskIds;
    private TaskStatus newStatus;
    private UUID assignToEmployeeId;
}