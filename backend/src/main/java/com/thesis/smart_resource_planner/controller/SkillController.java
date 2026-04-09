package com.thesis.smart_resource_planner.controller;

import com.thesis.smart_resource_planner.model.dto.SkillDTO;
import com.thesis.smart_resource_planner.service.SkillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Controller for managing skills.
 * Provides endpoints to record, view, modify, and delete skill categories and
 * traits.
 */
@RestController
@RequestMapping("/api/skills")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*", maxAge = 3600)
public class SkillController {

    private final SkillService skillService;

    /**
     * Creates a new skill in the system.
     * Employees can also create skills for themselves or others.
     *
     * @param skillDTO The skill creation input.
     * @return ResponseEntity with the successfully created skill, or conflicts if
     *         already exists.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')") // Allow employees to create skills
    public ResponseEntity<SkillDTO> createSkill(@Valid @RequestBody SkillDTO skillDTO) {
        try {
            SkillDTO created = skillService.createSkill(skillDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (Exception e) {
            // If skill exists, try to return it
            try {
                SkillDTO existing = skillService.getSkillByName(skillDTO.getName());
                return ResponseEntity.status(HttpStatus.CONFLICT).body(existing);
            } catch (Exception ex) {
                throw e;
            }
        }
    }

    /**
     * Retrieves a skill specifically by its ID.
     *
     * @param id The unique identifier of the skill.
     * @return ResponseEntity with the skill details.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<SkillDTO> getSkillById(@PathVariable UUID id) {
        SkillDTO skill = skillService.getSkillById(id);
        return ResponseEntity.ok(skill);
    }

    /**
     * Retrieves a skill specifically by its name.
     *
     * @param name The name of the skill.
     * @return ResponseEntity with the skill specifics.
     */
    @GetMapping("/name/{name}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')") // Allow employees
    public ResponseEntity<SkillDTO> getSkillByName(@PathVariable String name) {
        SkillDTO skill = skillService.getSkillByName(name);
        return ResponseEntity.ok(skill);
    }

    /**
     * Fetches all registered skills throughout the system.
     *
     * @return ResponseEntity with a raw array listing of all skills mapped.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<SkillDTO>> getAllSkills() {
        List<SkillDTO> skills = skillService.getAllSkills();
        return ResponseEntity.ok(skills);
    }

    /**
     * Fetches a group of skills designated into a common category.
     *
     * @param category The name category to fetch (e.g., frontend, backend).
     * @return ResponseEntity containing closely related skills mapping.
     */
    @GetMapping("/category/{category}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<List<SkillDTO>> getSkillsByCategory(@PathVariable String category) {
        List<SkillDTO> skills = skillService.getSkillsByCategory(category);
        return ResponseEntity.ok(skills);
    }

    /**
     * Will match the provided skill directly or create an unknown missing element
     * actively upon the fly.
     *
     * @param request Custom associative mapping request representing a skill
     *                metadata request.
     * @return ResponseEntity revealing properly generated or retrieved skill
     *         element representation.
     */
    @PostMapping("/get-or-create")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'EMPLOYEE')")
    public ResponseEntity<SkillDTO> getOrCreateSkill(@RequestBody Map<String, String> request) {
        String skillName = request.get("name");

        if (skillName == null || skillName.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        SkillDTO skill = skillService.getOrCreateSkill(skillName.trim());
        return ResponseEntity.ok(skill);
    }

    /**
     * Fully replaces details corresponding to a targeted skill unit.
     * Admin/Manager permission levels enforced.
     *
     * @param id       The target skill's UUID.
     * @param skillDTO Replacement detail structures.
     * @return ResponseEntity holding refreshed document model.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<SkillDTO> updateSkill(
            @PathVariable UUID id,
            @Valid @RequestBody SkillDTO skillDTO) {
        SkillDTO updated = skillService.updateSkill(id, skillDTO);
        return ResponseEntity.ok(updated);
    }

    /**
     * Irreversibly deletes specific skill logic mapped instance via identifying
     * UUID.
     * Exclusively managed by direct admin credentials overriding.
     *
     * @param id The ID referencing the target skill payload.
     * @return Standard deletion HTTP success callback structure (No content).
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteSkill(@PathVariable UUID id) {
        skillService.deleteSkill(id);
        return ResponseEntity.noContent().build();
    }
}